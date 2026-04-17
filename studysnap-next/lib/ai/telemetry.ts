/**
 * Tiny structured-logger for AI provider events. Outputs one JSON line per
 * event — Vercel log search picks these up cleanly. Prefixed with [TELEM]
 * so simple grep works too.
 *
 * Keep this zero-dependency on purpose: no external shipping, no buffers,
 * no retries. Just fmt+console.log so errors in the logger never break
 * the main pipeline.
 */

export type ProviderOutcome =
  | 'success'
  | 'rate_limit'
  | 'bad_json'
  | 'bad_response'
  | 'upstream_error'
  | 'no_key'
  | 'transient_error'
  | 'minimal_retry_success'
  | 'wait_retry_success';

export interface ProviderEvent {
  reqId: string;
  providerId: string;
  outcome: ProviderOutcome;
  elapsedMs: number;
  tokensUsed?: number;
  errorCode?: string;
}

export function logProviderEvent(event: ProviderEvent) {
  try {
    // eslint-disable-next-line no-console
    const { reqId, providerId, outcome, elapsedMs, tokensUsed, errorCode } = event;
    console.log(`[TELEM] ${JSON.stringify({ ts: new Date().toISOString(), kind: 'provider', reqId, providerId, outcome, elapsedMs, tokensUsed, errorCode })}`);
  } catch {
    // never throw from telemetry
  }
}

export interface RequestSummary {
  reqId: string;
  kind: 'process' | 'chat';
  userId: string;
  success: boolean;
  providerUsed?: string;
  totalAttempts: number;
  totalTokens: number;
  chunks?: number;
  cached?: boolean;
  degraded?: boolean;
  elapsedMs: number;
  errorCode?: string;
}

export function logRequestSummary(summary: RequestSummary) {
  try {
    // eslint-disable-next-line no-console
    const { reqId, userId, success, providerUsed, totalAttempts, totalTokens, chunks, cached, degraded, elapsedMs, errorCode } = summary;
    console.log(`[TELEM] ${JSON.stringify({ ts: new Date().toISOString(), kind: 'request', requestKind: summary.kind, reqId, userId, success, providerUsed, totalAttempts, totalTokens, chunks, cached, degraded, elapsedMs, errorCode })}`);
  } catch {
    // never throw from telemetry
  }
}
