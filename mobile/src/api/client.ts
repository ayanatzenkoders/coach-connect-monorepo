import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../config';

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
    const err = (data ?? {}) as { code?: string; message?: string | string[] };
    // Validation errors from the backend come as a list of messages; show the first one.
    const message = Array.isArray(err.message) ? err.message[0] : err.message;
    throw new ApiError(response.status, err.code ?? 'UNKNOWN_ERROR', message ?? 'Something went wrong.');
  }
  return data as T;
}
