import { env } from '../../env';
import { SYSTEM_PROMPT, buildUserPrompt } from '../../prompts';
import { STUDY_MATERIAL_SCHEMA, validateStudyMaterial } from '../schema';
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
  opts: { minimal?: boolean } = {},
): Promise<ProviderResult> {
  const key = env.googleApiKey;
  if (!key) throw new TransientAIError('NO_KEY', `GOOGLE_API_KEY not configured for ${modelName}`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: buildUserPrompt(text, plan, { minimal: opts.minimal }) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(STUDY_MATERIAL_SCHEMA),
      maxOutputTokens: plan === 'PRO' ? 8192 : 4096,
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
  if (!raw) throw new TransientAIError('BAD_RESPONSE', `Gemini ${modelName} returned no content`);

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    throw new TransientAIError('BAD_JSON', `Gemini ${modelName} returned invalid JSON`);
  }

  const material = validateStudyMaterial(parsed);
  const tokens = (data?.usageMetadata?.promptTokenCount ?? 0) + (data?.usageMetadata?.candidatesTokenCount ?? 0);
  return { material, model: modelName, tokensUsed: tokens };
}
