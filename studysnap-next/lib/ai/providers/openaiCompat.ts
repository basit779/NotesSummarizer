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

/** Parse the standard HTTP `Retry-After` header. Groq / OpenRouter / Mistral /
 *  GitHub all set it on 429s. Returns seconds to wait, or undefined. */
function parseRetryAfterHeader(res: Response): number | undefined {
  const header = res.headers.get('retry-after');
  if (!header) return undefined;
  const asNum = Number(header);
  if (Number.isFinite(asNum) && asNum > 0) return Math.ceil(asNum);
  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) {
    const diff = Math.ceil((asDate - Date.now()) / 1000);
    if (diff > 0) return diff;
  }
  return undefined;
}

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
  /** Aggressive trim mode — see ProviderRunOptions in types.ts. */
  ultraMinimal?: boolean;
  /** PDF page count for tier selection — forwarded to buildUserPrompt. */
  pages?: number;
  /** XL 2-pass signal — see ProviderRunOptions in types.ts. */
  pass?: 1 | 2;
  /**
   * Cap on completion tokens. Honors each provider's actual ceiling.
   * Gemini supports 8192 for FREE+PRO. Groq supports 8192. GitHub Models
   * gpt-4o-mini has only 8k TOTAL context so the cap must leave headroom
   * for input — pass ~3500 there.
   */
  maxOutputTokens?: number;
  /** Provider-specific extras spread into the request body. Used for DeepSeek's
   *  `thinking: { type: 'disabled' }` flag — V4-Flash defaults to thinking mode
   *  which breaks JSON output. Other providers ignore unknown fields. */
  extraBody?: Record<string, unknown>;
  /** Abort timeout in ms. Default 25_000 (chat + legacy paths). Per-provider
   *  Inngest steps pass 55_000 since each provider gets its own 60s Vercel
   *  function invocation under the new orchestrator. */
  timeoutMs?: number;
}): Promise<ProviderResult> {
  const {
    baseUrl, apiKey, modelName, displayName, text, plan, extraHeaders = {}, supportsJsonSchema = true, minimal = false,
    ultraMinimal = false, pages, pass, maxOutputTokens, extraBody, timeoutMs = 25_000,
  } = args;

  if (!apiKey) throw new TransientAIError('NO_KEY', `API key missing for ${displayName}`);

  const effectiveSchema = pass === 1 ? PASS1_SCHEMA : pass === 2 ? PASS2_SCHEMA : STUDY_MATERIAL_SCHEMA;
  const schemaInstruction = `Respond with ONLY a JSON object matching this schema (no prose, no code fences):
${JSON.stringify(effectiveSchema)}`;

  const userPromptText = pass === 1
    ? buildUserPromptPass1(text, { minimal, ultraMinimal, pages })
    : pass === 2
    ? buildUserPromptPass2(text, { minimal, ultraMinimal, pages })
    : buildUserPrompt(text, plan, { minimal, ultraMinimal, pages });
  const userPrompt = userPromptText + '\n\n' + schemaInstruction;

  const body: Record<string, unknown> = {
    model: modelName,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: maxOutputTokens ?? 8192,
    ...(extraBody ?? {}),
  };
  if (supportsJsonSchema) body.response_format = { type: 'json_object' };

  // DEBUG: verify extraBody (e.g. DeepSeek thinking-mode disable) reached body.
  // Logs only field names + the thinking field — does not leak prompt content.
  // eslint-disable-next-line no-console
  console.log(`[DEBUG][openaiCompat] body keys: ${JSON.stringify(Object.keys(body))}`);
  // eslint-disable-next-line no-console
  console.log(`[DEBUG][openaiCompat] thinking field: ${JSON.stringify((body as any).thinking)}`);

  // Client-side abort timeout (default 25s, configurable via timeoutMs).
  //
  // 25s: chat path + legacy shared-budget callers. Vercel Hobby kills the
  // function at 60s — without a client timeout, fetch() rides the function
  // out to its hard kill and there's no headroom for the next provider.
  //
  // 55s: per-provider Inngest steps (lib/inngest.ts) — each provider gets
  // its own 60s function invocation, so the timeout can use most of the
  // budget. This is what lets DeepSeek (~50-80 tok/s × ~4K tokens minimal
  // = 50-80s) actually finish on Hobby instead of always aborting at 25s.
  //
  // Uses AbortSignal.timeout (Node 18.17+) — undici handles connect-phase
  // and awaiting-headers hangs reliably, unlike AbortController + setTimeout
  // which was observed NOT firing on a 60s DeepSeek hang (2026-05-02).
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new TransientAIError('PROVIDER_TIMEOUT', `${displayName} did not respond within ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  }

  if (res.status === 429) throw new TransientAIError('RATE_LIMIT', `${displayName} rate-limited`, 429, parseRetryAfterHeader(res));
  if (res.status >= 500) throw new TransientAIError('UPSTREAM', `${displayName} ${res.status}`, res.status);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (isInputTooLargeBody(errText)) {
      // eslint-disable-next-line no-console
      console.warn(`[AI][${displayName}] INPUT_TOO_LARGE — raw body: ${errText.slice(0, 500)}`);
      throw new TransientAIError('INPUT_TOO_LARGE', `${displayName} rejected input as too large: ${errText.slice(0, 200)}`, res.status);
    }
    throw new TransientAIError('ERROR', `${displayName} failed: ${res.status} ${errText.slice(0, 200)}`, res.status);
  }

  const data = await res.json() as any;
  const content = data?.choices?.[0]?.message?.content;
  const finishReason = data?.choices?.[0]?.finish_reason ?? 'unknown';
  const promptTok = data?.usage?.prompt_tokens ?? 0;
  const completionTok = data?.usage?.completion_tokens ?? 0;

  // Surface finish_reason + separate token counts so MAX_TOKENS truncation
  // is visible in Vercel logs rather than hidden inside combined tokensUsed.
  // eslint-disable-next-line no-console
  console.log(`[AI][${displayName}] pass=${pass ?? 'single'} finish=${finishReason} promptTok=${promptTok} completionTok=${completionTok}`);

  if (!content || typeof content !== 'string') {
    throw new TransientAIError('BAD_RESPONSE', `${displayName} returned no content (finish=${finishReason})`);
  }

  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  // OpenAI-compat finish_reason for truncation is 'length'.
  const wasTruncated = finishReason === 'length';

  let parsed: unknown;
  try { parsed = JSON.parse(cleaned); } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      if (wasTruncated) throw new TransientAIError('MAX_TOKENS', `${displayName} output truncated (finish=length)`);
      throw new TransientAIError('BAD_JSON', `${displayName} returned invalid JSON (finish=${finishReason})`);
    }
    try { parsed = JSON.parse(match[0]); } catch {
      if (wasTruncated) throw new TransientAIError('MAX_TOKENS', `${displayName} output truncated (finish=length)`);
      throw new TransientAIError('BAD_JSON', `${displayName} returned invalid JSON (finish=${finishReason})`);
    }
  }

  const material = pass === 1 ? validatePass1(parsed, displayName)
    : pass === 2 ? validatePass2(parsed, displayName)
    : validateStudyMaterial(parsed, displayName);
  return { material, model: modelName, tokensUsed: promptTok + completionTok };
}
