import { env } from '../../env';
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  buildUserPromptPass1,
  buildUserPromptPass2,
  buildUserPromptPass3,
  buildUserPromptPass4,
} from '../../prompts';
import {
  STUDY_MATERIAL_SCHEMA,
  PASS1_SCHEMA,
  PASS2_SCHEMA,
  PASS3_SCHEMA,
  PASS4_SCHEMA,
  validateStudyMaterial,
  validatePass1,
  validatePass2,
  validatePass3,
  validatePass4,
} from '../schema';
import { ProviderResult, TransientAIError } from '../types';
import { isInputTooLargeBody } from '../errorClassify';

/**
 * Parse retry hint from a 429 response. Tries (in order):
 *   1. Standard HTTP `Retry-After` header — integer seconds or HTTP-date.
 *   2. Google's `RetryInfo` detail in the JSON body:
 *      `{ error: { details: [{ "@type": "...RetryInfo", retryDelay: "60s" }] } }`
 *
 * Returns seconds to wait, or `undefined` if no hint was provided.
 */
async function parseGeminiRetryAfter(res: Response): Promise<number | undefined> {
  const header = res.headers.get('retry-after');
  if (header) {
    const asNum = Number(header);
    if (Number.isFinite(asNum) && asNum > 0) return Math.ceil(asNum);
    const asDate = Date.parse(header);
    if (Number.isFinite(asDate)) {
      const diff = Math.ceil((asDate - Date.now()) / 1000);
      if (diff > 0) return diff;
    }
  }
  try {
    const body = await res.clone().json();
    const details: any[] = body?.error?.details ?? [];
    const retryInfo = details.find((d) => typeof d?.['@type'] === 'string' && d['@type'].includes('RetryInfo'));
    const delayStr = retryInfo?.retryDelay;
    if (typeof delayStr === 'string') {
      const m = delayStr.match(/^(\d+(?:\.\d+)?)s$/);
      if (m) return Math.ceil(parseFloat(m[1]));
    }
  } catch {
    // body may not be JSON — swallow
  }
  return undefined;
}

function toGeminiSchema(s: any): any {
  if (Array.isArray(s)) return s.map(toGeminiSchema);
  if (s && typeof s === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(s)) {
      if (k === 'type') out.type = String(v).toUpperCase();
      else out[k] = toGeminiSchema(v);
    }
    return out;
  }
  return s;
}

export async function geminiProvider(
  modelName: string,
  text: string,
  plan: 'FREE' | 'PRO',
  opts: { minimal?: boolean; ultraMinimal?: boolean; pages?: number; pass?: 1 | 2 | 3 | 4; timeoutMs?: number } = {},
): Promise<ProviderResult> {
  const key = env.googleApiKey;
  if (!key) throw new TransientAIError('NO_KEY', `GOOGLE_API_KEY not configured for ${modelName}`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;

  // Pass selection — multi-pass uses a narrower schema + narrower prompt each
  // call, so the output-token ceiling serves one slice of the pack at a time.
  const passOpts = { minimal: opts.minimal, ultraMinimal: opts.ultraMinimal, pages: opts.pages };
  const userPromptText =
    opts.pass === 1 ? buildUserPromptPass1(text, passOpts)
    : opts.pass === 2 ? buildUserPromptPass2(text, passOpts)
    : opts.pass === 3 ? buildUserPromptPass3(text, passOpts)
    : opts.pass === 4 ? buildUserPromptPass4(text, passOpts)
    : buildUserPrompt(text, plan, passOpts);

  const responseSchema =
    opts.pass === 1 ? PASS1_SCHEMA
    : opts.pass === 2 ? PASS2_SCHEMA
    : opts.pass === 3 ? PASS3_SCHEMA
    : opts.pass === 4 ? PASS4_SCHEMA
    : STUDY_MATERIAL_SCHEMA;

  // Passes 2/3/4 only generate a slice of the pack — well under 4K tokens
  // each. Capping at 4096 stops 2.5-flash from drifting into MAX_TOKENS
  // truncation and cascading to flash-lite.
  //
  // Single-pass: 2.5 family supports 64K output, so 16384 gives massive
  // headroom (needed after the medium-tier TIER_COUNTS bump pushed output to
  // ~5.6K and prod hit finish=MAX_TOKENS at 8K). Gemini 2.0 Flash caps at
  // 8192 output — requesting more can be rejected, so clamp it per-model.
  const singlePassCap = modelName.startsWith('gemini-2.0') ? 8192 : 16384;
  const maxOutputTokens = opts.pass && opts.pass >= 2 ? 4096 : singlePassCap;

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: userPromptText }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(responseSchema),
      maxOutputTokens,
      temperature: 0.4,
    },
  };

  // Client-side abort timeout (default 25s, configurable). 25s for chat +
  // legacy shared-budget callers; 55s when called from per-provider Inngest
  // steps where each provider gets its own 60s function invocation. Same
  // AbortSignal.timeout pattern as openaiCompat — undici handles connect-phase
  // / awaiting-headers hangs reliably.
  const timeoutMs = opts.timeoutMs ?? 25_000;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new TransientAIError('PROVIDER_TIMEOUT', `Gemini ${modelName} did not respond within ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  }

  if (res.status === 429) {
    const retryAfterSeconds = await parseGeminiRetryAfter(res);
    throw new TransientAIError('RATE_LIMIT', `Gemini ${modelName} rate-limited`, 429, retryAfterSeconds);
  }
  if (res.status >= 500) throw new TransientAIError('UPSTREAM', `Gemini ${modelName} ${res.status}`, res.status);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (isInputTooLargeBody(errText)) {
      // Log the RAW body so we can see if a provider's wording drifts (the
      // matcher in errorClassify.ts is substring-based and may need updating).
      // eslint-disable-next-line no-console
      console.warn(`[AI][gemini] ${modelName} INPUT_TOO_LARGE — raw body: ${errText.slice(0, 500)}`);
      throw new TransientAIError('INPUT_TOO_LARGE', `Gemini ${modelName} rejected input as too large: ${errText.slice(0, 200)}`, res.status);
    }
    throw new TransientAIError('ERROR', `Gemini ${modelName} failed: ${res.status} ${errText.slice(0, 200)}`, res.status);
  }

  const data = await res.json() as any;
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  const finishReason = data?.candidates?.[0]?.finishReason ?? 'UNKNOWN';
  const promptTok = data?.usageMetadata?.promptTokenCount ?? 0;
  const completionTok = data?.usageMetadata?.candidatesTokenCount ?? 0;

  // Surface finish_reason + separate token counts. tokensUsed (combined) hid
  // truncation signal in the 45-page XL test — this makes MAX_TOKENS visible.
  // eslint-disable-next-line no-console
  console.log(`[AI][gemini] ${modelName} pass=${opts.pass ?? 'single'} finish=${finishReason} promptTok=${promptTok} completionTok=${completionTok}`);

  if (!raw) throw new TransientAIError('BAD_RESPONSE', `Gemini ${modelName} returned no content (finish=${finishReason})`);

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    // Distinguish genuine JSON parse errors from truncation at the 8192
    // output-token ceiling. MAX_TOKENS bubbles up as its own code so the
    // fallback runner can skip minimal-retry (which never helps — the
    // schema is what's too big, not the prompt).
    if (finishReason === 'MAX_TOKENS') {
      throw new TransientAIError('MAX_TOKENS', `Gemini ${modelName} output truncated at 8192 tokens (finish=MAX_TOKENS)`);
    }
    throw new TransientAIError('BAD_JSON', `Gemini ${modelName} returned invalid JSON (finish=${finishReason})`);
  }

  const material =
    opts.pass === 1 ? validatePass1(parsed, modelName)
    : opts.pass === 2 ? validatePass2(parsed, modelName)
    : opts.pass === 3 ? validatePass3(parsed, modelName)
    : opts.pass === 4 ? validatePass4(parsed, modelName)
    : validateStudyMaterial(parsed, modelName);
  return { material, model: modelName, tokensUsed: promptTok + completionTok };
}
