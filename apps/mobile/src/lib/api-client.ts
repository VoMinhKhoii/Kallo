import { supabase } from './supabase';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!BASE_URL) {
  throw new Error(
    'Missing EXPO_PUBLIC_API_BASE_URL — see apps/mobile/.env.example.'
  );
}

/**
 * Client-side mirror of lib/errors.ts `ApiError` / `parseApiError`.
 *
 * We re-implement rather than import because lib/errors.ts imports
 * `next/server`, which must never enter the React Native bundle. The server
 * error envelope is `{ error: { code, status, retryable, message } }`.
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly retryable: boolean,
    message: string,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  const retryHeader = res.headers.get('Retry-After');
  const retryAfterSeconds = retryHeader ? Number(retryHeader) : undefined;
  try {
    const body = (await res.json()) as {
      error?: {
        code?: string;
        status?: number;
        retryable?: boolean;
        message?: string;
      };
    };
    const err = body?.error;
    return new ApiError(
      typeof err?.code === 'string' ? err.code : 'UNKNOWN',
      typeof err?.status === 'number' ? err.status : res.status,
      typeof err?.retryable === 'boolean' ? err.retryable : false,
      err?.message ?? `HTTP ${res.status}`,
      retryAfterSeconds
    );
  } catch {
    return new ApiError('UNKNOWN', res.status, false, `HTTP ${res.status}`, retryAfterSeconds);
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers = await authHeaders();
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw await toApiError(res);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const apiGet = <T>(path: string) => request<T>('GET', path);
export const apiPost = <T>(path: string, body?: unknown) =>
  request<T>('POST', path, body ?? {});
export const apiPut = <T>(path: string, body?: unknown) =>
  request<T>('PUT', path, body ?? {});
export const apiDelete = <T>(path: string) => request<T>('DELETE', path);

/**
 * Fire-and-forget ping to wake a scale-to-zero backend (Cloud Run) on launch,
 * so the first authed request doesn't pay the cold-start latency. Hits the
 * public health endpoint; failures are swallowed (offline / unreachable is fine).
 */
export async function warmupApi(): Promise<void> {
  try {
    await fetch(`${BASE_URL}/api/healthz`, { method: 'GET' });
  } catch {
    // Best-effort warmup — ignore failures.
  }
}
