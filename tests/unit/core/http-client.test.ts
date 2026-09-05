import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { request } from '../../../src/core/http-client.js';
import { UnipayError } from '../../../src/core/errors.js';

const BASE = 'http://localhost:4899';

const handlers = [
  http.post(`${BASE}/charge`, () =>
    HttpResponse.json({ id: 'pi_123', status: 'succeeded' }, { status: 200 }),
  ),
  http.post(`${BASE}/token`, () => HttpResponse.text('ok', { status: 200 })),
  http.get(`${BASE}/slow`, async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return HttpResponse.json({});
  }),
  http.get(`${BASE}/error`, () => HttpResponse.json({ error: 'invalid_api_key' }, { status: 401 })),
  http.get(`${BASE}/server-error`, () =>
    HttpResponse.json({ error: 'internal_error' }, { status: 500 }),
  ),
];

const server = setupServer(...handlers);

describe('http-client (msw)', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterAll(() => server.close());

  it('success 200 resolves with parsed JSON body', async () => {
    const res = await request(`${BASE}/charge`, { method: 'POST', body: { amount: 1000 } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'pi_123', status: 'succeeded' });
  });

  it('non-2xx returns raw status and body without throwing', async () => {
    const res = await request(`${BASE}/error`, { method: 'GET' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_api_key' });
  });

  it('non-2xx 500 returns raw status and body', async () => {
    const res = await request(`${BASE}/server-error`, { method: 'GET' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'internal_error' });
  });

  it('timeout rejects with UnipayError TIMEOUT', async () => {
    await expect(request(`${BASE}/slow`, { method: 'GET', timeoutMs: 5 })).rejects.toThrow(
      UnipayError,
    );
  });

  it('form-urlencoded content type is encoded correctly', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await request(`${BASE}/token`, {
      method: 'POST',
      body: { grant_type: 'client_credentials' },
      contentType: 'form-urlencoded',
    });
    expect(res.status).toBe(200);

    const callArgs = fetchSpy.mock.calls[0] as [unknown, RequestInit];
    const opts = callArgs[1];
    expect(opts.body).toBe('grant_type=client_credentials');
    fetchSpy.mockRestore();
  });
});
