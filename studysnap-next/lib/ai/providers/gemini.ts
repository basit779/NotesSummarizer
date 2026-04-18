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

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: userPromptText }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(responseSchema),
      maxOutputTokens: 8192,
      temperature: 0.4,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 429) throw new TransientAIError('RATE_LIMIT', `Gemini ${modelName} rate-limited`, 429);
  if (res.status >= 500) throw new TransientAIError('UPSTREAM', `Gemini ${modelName} ${res.status}`, res.status);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
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
    throw new TransientAIError('BAD_JSON', `Gemini ${modelName} returned invalid JSON (finish=${finishReason})`);
  }

  const material = opts.pass === 1 ? validatePass1(parsed)
    : opts.pass === 2 ? validatePass2(parsed)
    : validateStudyMaterial(parsed);
  return { material, model: modelName, tokensUsed: promptTok + completionTok };
}
