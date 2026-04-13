import { SYSTEM_PROMPT, buildUserPrompt } from '../../../utils/prompts';
import { STUDY_MATERIAL_SCHEMA, validateStudyMaterial } from '../schema';
import { ProviderResult, TransientAIError } from '../types';

/**
 * Generic OpenAI-compatible chat/completions caller used by Groq, OpenRouter, and Mistral.
 * All three expose /v1/chat/completions with Bearer auth.
 */
export async function openaiCompat(args: {
  baseUrl: string;
  apiKey: string | undefined;
  modelName: string;
  displayName: string;
  text: string;
  plan: 'FREE' | 'PRO';
  extraHeaders?: Record<string, string>;
  /** Some providers don't support response_format json_schema — if false, we instruct via prompt only. */
  supportsJsonSchema?: boolean;
}): Promise<ProviderResult> {
  const {
    baseUrl, apiKey, modelName, displayName, text, plan, extraHeaders = {}, supportsJsonSchema = true,
  } = args;

  if (!apiKey) throw new TransientAIError('NO_KEY', `API key missing for ${displayName}`);

  const schemaInstruction = `Respond with ONLY a JSON object matching this schema (no prose, no code fences):
${JSON.stringify(STUDY_MATERIAL_SCHEMA)}`;

  const userPrompt = buildUserPrompt(text, plan) + '\n\n' + schemaInstruction;

  const body: Record<string, unknown> = {
    model: modelName,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: plan === 'PRO' ? 8192 : 4096,
  };

  if (supportsJsonSchema) {
    body.response_format = { type: 'json_object' };
  }

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

  // strip code fences if the model added them despite instructions
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  let parsed: unknown;
  try { parsed = JSON.parse(cleaned); } catch {
    // last resort: try to find {...}
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
