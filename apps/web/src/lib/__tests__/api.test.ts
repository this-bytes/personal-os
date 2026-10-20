import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, apiRequest, errorMessage } from '../api';

/**
 * The API client is the only place the web client talks to the server, so
 * everything it promises the rest of the app is asserted here: the error
 * envelope, the offline signal and the revision-conflict signal.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function stubFetch(response: () => Response | Promise<Response>): ReturnType<typeof vi.fn> {
  const mock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(response()),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('returns the decoded body of a successful response', async () => {
    stubFetch(() => jsonResponse({ ok: true }));

    await expect(apiRequest<{ ok: boolean }>('/health')).resolves.toEqual({ ok: true });
  });

  it('prefixes a relative path with the API base', async () => {
    const fetchMock = stubFetch(() => jsonResponse({}));

    await apiRequest('/agents');

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/agents');
  });

  it('leaves an absolute URL untouched', async () => {
    const fetchMock = stubFetch(() => jsonResponse({}));

    await apiRequest('https://example.com/hook');

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://example.com/hook');
  });

  it('drops empty query values and encodes the rest', async () => {
    const fetchMock = stubFetch(() => jsonResponse({}));

    await apiRequest('/agents', { query: { workspaceId: 'w 1', empty: '', missing: undefined } });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/agents?workspaceId=w+1');
  });

  it('sends a JSON body with the matching content type', async () => {
    const fetchMock = stubFetch(() => jsonResponse({}));

    await apiRequest('/agents', { method: 'POST', body: { name: 'Echo' } });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ name: 'Echo' }));
  });

  it('turns a structured error envelope into an ApiError', async () => {
    stubFetch(() =>
      jsonResponse(
        {
          error: {
            code: 'revision_conflict',
            message: 'The resource changed.',
            details: { expected: 1 },
          },
        },
        409,
      ),
    );

    const error = (await apiRequest('/resources/1').catch((cause: unknown) => cause)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('revision_conflict');
    expect(error.status).toBe(409);
    expect(error.message).toBe('The resource changed.');
    expect(error.details).toEqual({ expected: 1 });
    expect(error.isRevisionConflict).toBe(true);
    expect(error.isOffline).toBe(false);
  });

  it('falls back to a generic envelope when the failure body has no error object', async () => {
    stubFetch(() => jsonResponse({ oops: true }, 500));

    const error = (await apiRequest('/x').catch((cause: unknown) => cause)) as ApiError;

    expect(error.code).toBe('unknown_error');
    expect(error.status).toBe(500);
  });

  it('reports an unreachable server as an offline failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('failed to fetch'))),
    );

    const error = (await apiRequest('/x').catch((cause: unknown) => cause)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.isOffline).toBe(true);
    expect(error.isRevisionConflict).toBe(false);
  });

  it('returns undefined for an empty 204 response', async () => {
    stubFetch(() => new Response(null, { status: 204 }));

    await expect(apiRequest('/x')).resolves.toBeUndefined();
  });

  it('survives a successful response whose body is not JSON', async () => {
    stubFetch(() => new Response('not json', { status: 200 }));

    await expect(apiRequest('/x')).resolves.toBeNull();
  });
});

describe('api', () => {
  it('sends a DELETE without a body', async () => {
    const fetchMock = stubFetch(() => jsonResponse({}));

    await api.delete('/agents/a1');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
  });
});

describe('errorMessage', () => {
  it('uses the message of an ApiError', () => {
    expect(errorMessage(new ApiError('not_found', 'No such agent.', 404))).toBe('No such agent.');
  });

  it('uses the message of a plain Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('falls back to a generic message', () => {
    expect(errorMessage('something odd')).toBe('Something went wrong.');
  });
});
