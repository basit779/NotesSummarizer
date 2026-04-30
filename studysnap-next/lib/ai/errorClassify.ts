/**
 * Detect "input is too large for this provider" rejections from upstream
 * error bodies. Different providers phrase this differently (and they CHANGE
 * the wording over time), so the matcher is intentionally lenient: any of
 * these substrings, case-insensitive, anywhere in the body counts.
 *
 * TODO: provider error wording drifts. If a real upload starts failing
 * silently with a generic ERROR code where the body actually says "too long"
 * in some new way, add the new substring here. The provider files log the
 * raw body when this fires so drift is visible in the [AI] logs.
 *
 * Why a substring matcher and not a per-provider parser:
 *   - Gemini, Mistral, Groq, OpenRouter all return slightly different shapes;
 *     keeping a single phrase-list is simpler than four parsers.
 *   - The cost of a false positive (mis-classifying a generic 4xx as
 *     INPUT_TOO_LARGE) is "user sees DOC_TOO_LARGE error instead of generic" —
 *     which is fine.
 *   - The cost of a false negative is "input-too-large falls through to next
 *     provider, wastes one attempt" — also fine, because every provider will
 *     reject same-shape input the same way and we'll surface a generic error
 *     after the chain. The diagnostic value is for visibility, not correctness.
 */
const INPUT_TOO_LARGE_PHRASES: readonly string[] = [
  'context length',
  'context window',
  'input too long',
  'input is too long',
  'input length exceeds',
  'prompt is too long',
  'too large',
  'max tokens',
  'exceeds the maximum',
  'request payload too large',
  'maximum context length',
  'token limit',
];

export function isInputTooLargeBody(body: string): boolean {
  if (!body) return false;
  const lower = body.toLowerCase();
  return INPUT_TOO_LARGE_PHRASES.some((p) => lower.includes(p));
}
