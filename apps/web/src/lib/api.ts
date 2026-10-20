/**
 * Typed fetch wrapper for the Personal OS HTTP API.
 *
 * Every call carries the session cookie. The backend answers failures with
 * a structured envelope — `{ error: { code, message, details } }` — which
 * is turned into an `ApiError` so callers never have to inspect the body.
 */

export interface ApiErrorEnvelope {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** True when the failure is a network / server-unreachable condition. */
  get isOffline(): boolean {
    return this.code === 'network_error';
  }

  /** True when the resource changed since it was read. */
  get isRevisionConflict(): boolean {
    return this.code === 'revision_conflict' || this.status === 409;
  }
}

const API_BASE = '/api';

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const base = path.startsWith('http')
    ? path
    : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function extractEnvelope(payload: unknown): ApiErrorEnvelope {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const envelope = (payload as { error: unknown }).error;
    if (envelope && typeof envelope === 'object') {
      const record = envelope as Record<string, unknown>;
      return {
        code: typeof record['code'] === 'string' ? record['code'] : 'unknown_error',
        message:
          typeof record['message'] === 'string'
            ? record['message']
            : 'The request failed for an unknown reason.',
        details: record['details'],
      };
    }
  }
  return { code: 'unknown_error', message: 'The request failed for an unknown reason.' };
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}

/** Perform an API call and return the decoded JSON body. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options;

  const headers = new Headers({ Accept: 'application/json' });
  let payload: BodyInit | undefined;
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: payload,
      credentials: 'include',
      ...(signal ? { signal } : {}),
    });
  } catch (cause) {
    throw new ApiError(
      'network_error',
      'Cannot reach the Personal OS server. Check that the API is running.',
      0,
      cause,
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const envelope = extractEnvelope(parsed);
    throw new ApiError(envelope.code, envelope.message, response.status, envelope.details);
  }

  return parsed as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    apiRequest<T>(path, {
      method: 'GET',
      ...(query ? { query } : {}),
      ...(signal ? { signal } : {}),
    }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};

/** Turn any thrown value into a human readable message. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
