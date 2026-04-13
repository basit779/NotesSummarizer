'use client';

const TOKEN_KEY = 'ss_token';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
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
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('ss_user');
    }
    const err: ApiError = Object.assign(new Error(data?.error?.message ?? 'Request failed'), {
      status: res.status,
      code: data?.error?.code ?? 'ERROR',
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
