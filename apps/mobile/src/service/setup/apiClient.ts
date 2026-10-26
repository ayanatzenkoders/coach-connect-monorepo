import type { ApiError as ApiErrorBody } from '@coach-connect/shared/api';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '@/src/constants';

/**
 * Every failed request becomes an ApiError, so screens never deal with raw responses.
 * `code` is the machine-readable code from the backend (e.g. INVALID_CREDENTIALS,
 * ACCOUNT_BANNED) and is what the app switches on. `status` is the HTTP status
 * (0 means we never got an answer: no internet, server down, or timeout).
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    /** The whole answer body, for extra fields such as `retryAfterSeconds` or `attemptsLeft`. */
    public readonly data: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Adds the "Authorization: Bearer ..." header. */
  accessToken?: string | null;
}

/** The one function every API call goes through. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, accessToken } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  // Cancel the request if the server does not answer in time.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }

  // Some answers (logout = 204) have no body.
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }

  if (!response.ok) {
    const err = (data ?? {}) as Partial<ApiErrorBody>;
    // Validation failures arrive as { message: 'Validation failed', errors: { field: [messages] } }:
    // show the first field message, which is written for people ("Password must be ...").
    const firstFieldMessage = err.errors ? Object.values(err.errors)[0]?.[0] : undefined;
    const message = firstFieldMessage ?? (Array.isArray(err.message) ? err.message[0] : err.message);
    throw new ApiError(response.status, err.code ?? 'UNKNOWN_ERROR', message ?? 'Something went wrong.', (data ?? {}) as Record<string, unknown>);
  }
  return data as T;
}
