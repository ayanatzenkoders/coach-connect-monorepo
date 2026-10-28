/**
 * The one place the web panel talks to the backend.
 * Every failure becomes an ApiError with the backend's machine-readable `code`
 * (INVALID_CREDENTIALS, FORBIDDEN_ROLE, ...), so pages never handle raw responses.
 */

import type { ApiError as ApiErrorBody } from '@coach-connect/shared/api';

/** In development Next forwards /api/* to the backend (see next.config.ts). */
const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number, // 0 = we never got an answer (offline, server down, timeout)
    public readonly code: string,
    message: string,
    public readonly data: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  accessToken?: string | null;
}

const TIMEOUT_MS = 15_000;

export async function apiRequest<T>(path: string, { method = 'GET', body, accessToken }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
  }

  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }

  if (!response.ok) {
    const err = (data ?? {}) as Partial<ApiErrorBody>;
    // Validation failures carry per-field messages: show the first one instead of "Validation failed".
    const firstFieldMessage = err.errors ? Object.values(err.errors)[0]?.[0] : undefined;
    const message = firstFieldMessage ?? (Array.isArray(err.message) ? err.message[0] : err.message);
    throw new ApiError(response.status, err.code ?? 'UNKNOWN_ERROR', message ?? 'Something went wrong.', (data ?? {}) as Record<string, unknown>);
  }
  return data as T;
}
