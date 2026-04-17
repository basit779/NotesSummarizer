'use client';

const TOKEN_KEY = 'ss_token';
const USER_KEY = 'ss_user';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function clearLocalAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

interface ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
}

async function request<T = any>(
  path: string,
  init: RequestInit & { json?: unknown; form?: FormData } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  } else if (init.form) {
    body = init.form; // browser sets multipart Content-Type with boundary
  }

  const res = await fetch(`/api${path}`, { ...init, headers, body });
  const text = await res.text();
  // Tolerant parse: non-JSON responses (Vercel HTML error pages, 502s from
  // gateway, etc.) shouldn't throw an uncaught SyntaxError — surface a clean
  // ApiError with the status instead.
  let data: any = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }

  if (!res.ok) {
    // Only clear local auth on 401s from auth endpoints. Unrelated 401s (stale
    // file ids, expired chat result refs, etc.) must NOT nuke the session.
    if (res.status === 401 && path.startsWith('/auth/')) {
      clearLocalAuth();
    }
    const fallbackMsg = res.status === 504 ? 'Request timed out — try again.'
      : res.status >= 500 ? 'Server error — please retry in a moment.'
      : 'Request failed';
    const err: ApiError = Object.assign(new Error(data?.error?.message ?? fallbackMsg), {
      status: res.status,
      code: data?.error?.code ?? `HTTP_${res.status}`,
      details: data?.error?.details,
    });
    throw err;
  }
  return data as T;
}

export const api = {
  get: <T = any>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T = any>(path: string, json?: unknown) => request<T>(path, { method: 'POST', json }),
  postForm: <T = any>(path: string, form: FormData) => request<T>(path, { method: 'POST', form }),
};
