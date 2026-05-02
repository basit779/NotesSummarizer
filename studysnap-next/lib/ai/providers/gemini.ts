import { env } from '../../env';
import { SYSTEM_PROMPT, buildUserPrompt, buildUserPromptPass1, buildUserPromptPass2 } from '../../prompts';
import {
  STUDY_MATERIAL_SCHEMA,
  PASS1_SCHEMA,
  PASS2_SCHEMA,
  validateStudyMaterial,
  validatePass1,
  validatePass2,
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
  opts: { minimal?: boolean; pages?: number; pass?: 1 | 2 } = {},
): Promise<ProviderResult> {
  const key = env.googleApiKey;
  if (!key) throw new TransientAIError('NO_KEY', `GOOGLE_API_KEY not configured for ${modelName}`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;

  // Pass selection — XL 2-pass uses narrower schema + narrower prompt each call,
  // so the 8192 output-token ceiling serves one half of the pack instead of both.
  const userPromptText = opts.pass === 1
    ? buildUserPromptPass1(text, { minimal: opts.minimal, pages: opts.pages })
    : opts.pass === 2
    ? buildUserPromptPass2(text, { minimal: opts.minimal, pages: opts.pages })
    : buildUserPrompt(text, plan, { minimal: opts.minimal, pages: opts.pages });

  const responseSchema = opts.pass === 1 ? PASS1_SCHEMA
    : opts.pass === 2 ? PASS2_SCHEMA
    : STUDY_MATERIAL_SCHEMA;

  // Pass 2 only generates flashcards + MCQs + tips + connections — well
  // under 4K tokens at the reduced XL counts. Capping at 4096 stops 2.5-flash
  // from drifting into MAX_TOKENS truncation and cascading to flash-lite.
  //
  // Single-pass: bumped 8192 → 16384 after the medium-tier TIER_COUNTS bump
  // (cards 14-26, MCQs 6-12) pushed estimated output to ~5.6K, and prod hit
  // finish=MAX_TOKENS at 8K with completionTok=6565 (cut mid-generation).
  // Gemini 2.5 Flash supports 64K max output — 16K gives massive headroom.
  const maxOutputTokens = opts.pass === 2 ? 4096 : 16384;

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

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

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

  const material = opts.pass === 1 ? validatePass1(parsed, modelName)
    : opts.pass === 2 ? validatePass2(parsed, modelName)
    : validateStudyMaterial(parsed, modelName);
  return { material, model: modelName, tokensUsed: promptTok + completionTok };
}
