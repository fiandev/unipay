import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { XenditGateway } from '../../../src/gateways/xendit/index.js';
import { UnipayError } from '../../../src/core/errors.js';

const WEBHOOK_TOKEN = 'xnd_webhook_token_abc123';

const gateway = new XenditGateway();
gateway.initialize({
  secretApiKey: 'xnd_secret_xyz',
  webhookVerificationToken: WEBHOOK_TOKEN,
  debug: false,
});

type ApiRequestMock = <T>() => Promise<{ status: number; body: T; headers: Headers }>;

const handlers = [
  http.post('https://api.xendit.co/v3/payment_requests', ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Basic ')) {
      return HttpResponse.json(
        { error_code: 'UNAUTHENTICATED', message: 'Invalid auth' },
        { status: 401 },
      );
    }

    const idempotencyKey = request.headers.get('X-IDEMPOTENCY-KEY');
    if (!idempotencyKey) {
      return HttpResponse.json(
        { error_code: 'MISSING_IDEMPOTENCY', message: 'Idempotency key required' },
        { status: 400 },
      );
    }

    return HttpResponse.json(
      {
        id: 'pr_d3c8f2a1-1234-5678-9abc-def012345678',
        reference_id: 'order-xnd-001',
        status: 'SUCCEEDED',
        request_amount: 50000,
        currency: 'IDR',
        country: 'ID',
        type: 'PAY',
        channel_code: 'ID_DANA',
        customer: {
          given_names: 'John',
          email: 'john@example.com',
        },
        created: '2026-07-17T12:00:00Z',
        updated: '2026-07-17T12:00:05Z',
      },
      { status: 200 },
    );
  }),

  http.get('https://api.xendit.co/v3/payment_requests/:id', ({ params }) => {
    const id = params.id as string;
    const statusMap: Record<string, string> = {
      pr_succeeded: 'SUCCEEDED',
      pr_failed: 'FAILED',
      pr_pending: 'PENDING',
      pr_expired: 'EXPIRED',
      pr_authorized: 'AUTHORIZED',
    };
    const status = statusMap[id] ?? 'PENDING';

    return HttpResponse.json(
      {
        id,
        reference_id: `order-${id}`,
        status,
        request_amount: 50000,
        currency: 'IDR',
        country: 'ID',
        type: 'PAY',
        channel_code: 'ID_DANA',
        created: '2026-07-17T12:00:00Z',
        updated: '2026-07-17T12:00:05Z',
        ...(status === 'FAILED'
          ? {
              failure_code: 'INSUFFICIENT_BALANCE',
              failure_message: 'Insufficient balance',
            }
          : {}),
      },
      { status: 200 },
    );
  }),

  http.post('https://api.xendit.co/v3/payment_requests/:id/refunds', () => {
    return HttpResponse.json(
      {
        id: 'ref_test_001',
        reference_id: 'order-xnd-refund',
        status: 'SUCCEEDED',
        request_amount: 25000,
        currency: 'IDR',
      },
      { status: 200 },
    );
  }),
];

const server = setupServer(...handlers);

describe('Xendit Integration', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  describe('createPayment', () => {
    it('sends correct auth header and request_amount field', async () => {
      const res = await gateway.createPayment({
        amount: 50000,
        currency: 'IDR',
        referenceId: 'order-xnd-001',
        country: 'ID',
        paymentMethod: 'ewallet',
      });

      expect(res.transactionId).toBe('pr_d3c8f2a1-1234-5678-9abc-def012345678');
      expect(res.status).toBe('SUCCESS');
      expect(res.gateway).toBe('xendit');
    });

    it('handles redirect action from payment request', async () => {
      const redirectGateway = new XenditGateway();
      redirectGateway.initialize({ secretApiKey: 'xnd_secret_xyz', debug: false });

      const mockRes = {
        id: 'pr_a5b6c7d8-3456-7890-abcd-ef0123456789',
        reference_id: 'order-xnd-redirect-001',
        status: 'REQUIRES_ACTION',
        request_amount: 75000,
        currency: 'IDR',
        country: 'ID',
        type: 'PAY',
        channel_code: 'CARDS',
        actions: [
          { type: 'REDIRECT_CUSTOMER', value: 'https://checkout.xendit.co/cards/redirect/abc123' },
        ],
        created: '2026-07-17T12:00:00Z',
        updated: '2026-07-17T12:00:05Z',
      };

      const origRequest = (redirectGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest;
      (redirectGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest = async () => ({
        status: 200,
        body: mockRes,
        headers: new Headers(),
      });

      const res = await redirectGateway.createPayment({
        amount: 75000,
        currency: 'IDR',
        referenceId: 'order-xnd-redirect-001',
        paymentMethod: 'card',
      });

      expect(res.status).toBe('PENDING');
      expect(res.redirectUrl).toBe('https://checkout.xendit.co/cards/redirect/abc123');

      (redirectGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest = origRequest;
    });

    it('sends for-user-id header when metadata.forUserId is set', async () => {
      const subGateway = new XenditGateway();
      subGateway.initialize({ secretApiKey: 'xnd_secret_xyz', debug: false });

      const origRequest = (subGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest;
      const capturedHeaders: Record<string, string> = {};
      (subGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest = async (
        _url: string,
        opts: { headers?: Record<string, string> },
      ) => {
        Object.assign(capturedHeaders, opts.headers ?? {});
        return {
          status: 200,
          body: {
            id: 'pr_test_sub',
            reference_id: 'order-sub-001',
            status: 'SUCCEEDED',
            request_amount: 30000,
            currency: 'IDR',
            country: 'ID',
            type: 'PAY',
            channel_code: 'ID_DANA',
            created: '2026-07-17T12:00:00Z',
            updated: '2026-07-17T12:00:05Z',
          },
          headers: new Headers(),
        };
      };

      await subGateway.createPayment({
        amount: 30000,
        currency: 'IDR',
        referenceId: 'order-sub-001',
        metadata: { forUserId: 'usr_acc_123' },
      });

      expect(capturedHeaders['for-user-id']).toBe('usr_acc_123');

      (subGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest = origRequest;
    });
  });

  describe('getPaymentStatus', () => {
    it.each([
      ['pr_succeeded', 'SUCCESS'],
      ['pr_failed', 'FAILED'],
      ['pr_pending', 'PENDING'],
      ['pr_expired', 'EXPIRED'],
      ['pr_authorized', 'PENDING'],
    ])('maps Xendit status %s -> %s', async (txnId, expectedStatus) => {
      const res = await gateway.getPaymentStatus(txnId);
      expect(res.status).toBe(expectedStatus);
      expect(res.transactionId).toBe(txnId);
    });
  });

  describe('handleWebhook', () => {
    it('verifies matching x-callback-token', () => {
      const payload = JSON.stringify({
        event: 'payment_request.succeeded',
        data: { id: 'pr_test_webhook' },
        created: '2026-07-17T12:00:00Z',
      });

      const result = gateway.handleWebhook(payload, WEBHOOK_TOKEN);
      expect(result.eventType).toBe('payment_request.succeeded');
      expect(result.transactionId).toBe('pr_test_webhook');
    });

    it('rejects non-matching x-callback-token', () => {
      const payload = JSON.stringify({
        event: 'payment_request.succeeded',
        data: { id: 'pr_test_webhook' },
      });

      expect(() => gateway.handleWebhook(payload, 'wrong_token')).toThrow(UnipayError);
    });

    it('rejects missing x-callback-token', () => {
      const payload = JSON.stringify({
        event: 'payment_request.succeeded',
        data: { id: 'pr_test_webhook' },
      });

      expect(() => gateway.handleWebhook(payload, null)).toThrow(UnipayError);
    });
  });
});
