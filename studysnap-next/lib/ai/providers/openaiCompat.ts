import { SYSTEM_PROMPT, buildUserPrompt } from '../../prompts';
import { STUDY_MATERIAL_SCHEMA, validateStudyMaterial } from '../schema';
import { ProviderResult, TransientAIError } from '../types';

export async function openaiCompat(args: {
  baseUrl: string;
  apiKey: string | undefined;
  modelName: string;
  displayName: string;
  text: string;
  plan: 'FREE' | 'PRO';
  extraHeaders?: Record<string, string>;
  supportsJsonSchema?: boolean;
  minimal?: boolean;
  /**
   * Cap on completion tokens. Honors each provider's actual ceiling.
   * Gemini supports 8192 for FREE+PRO. Groq supports 8192. GitHub Models
   * gpt-4o-mini has only 8k TOTAL context so the cap must leave headroom
   * for input — pass ~3500 there.
   */
  maxOutputTokens?: number;
}): Promise<ProviderResult> {
  const {
    baseUrl, apiKey, modelName, displayName, text, plan, extraHeaders = {}, supportsJsonSchema = true, minimal = false,
    maxOutputTokens,
  } = args;

  if (!apiKey) throw new TransientAIError('NO_KEY', `API key missing for ${displayName}`);

  const schemaInstruction = `Respond with ONLY a JSON object matching this schema (no prose, no code fences):
${JSON.stringify(STUDY_MATERIAL_SCHEMA)}`;

  const userPrompt = buildUserPrompt(text, plan, { minimal }) + '\n\n' + schemaInstruction;

  const body: Record<string, unknown> = {
    model: modelName,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: maxOutputTokens ?? 8192,
  };
  if (supportsJsonSchema) body.response_format = { type: 'json_object' };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) throw new TransientAIError('RATE_LIMIT', `${displayName} rate-limited`, 429);
  if (res.status >= 500) throw new TransientAIError('UPSTREAM', `${displayName} ${res.status}`, res.status);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new TransientAIError('ERROR', `${displayName} failed: ${res.status} ${errText.slice(0, 200)}`, res.status);
  }

  const data = await res.json() as any;
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new TransientAIError('BAD_RESPONSE', `${displayName} returned no content`);
  }

  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  let parsed: unknown;
  try { parsed = JSON.parse(cleaned); } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new TransientAIError('BAD_JSON', `${displayName} returned invalid JSON`);
    try { parsed = JSON.parse(match[0]); } catch {
      throw new TransientAIError('BAD_JSON', `${displayName} returned invalid JSON`);
    }
  }

  const material = validateStudyMaterial(parsed);
  const tokens = (data?.usage?.prompt_tokens ?? 0) + (data?.usage?.completion_tokens ?? 0);
  return { material, model: modelName, tokensUsed: tokens };
}
