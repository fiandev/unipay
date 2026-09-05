/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { StripeGateway } from '../../../src/gateways/stripe/index.js';
import { UnipayError } from '../../../src/core/errors.js';
import { hmacSha256Hex } from '../../../src/core/signature/index.js';

const WEBHOOK_SECRET = 'whsec_test_secret_abc123';

const gateway = new StripeGateway();
gateway.initialize({
  secretKey: 'sk_test_xyz',
  webhookSecret: WEBHOOK_SECRET,
  debug: false,
});

async function buildStripeSignature(payload: string, secret: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = await hmacSha256Hex(signedPayload, secret);
  return `t=${timestamp},v1=${signature}`;
}

type ApiRequestMock = () => Promise<{ status: number; body: unknown; headers: Headers }>;

const handlers = [
  http.post('https://api.stripe.com/v1/payment_intents', ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== 'Bearer sk_test_xyz') {
      return HttpResponse.json({ error: { message: 'Invalid API key' } }, { status: 401 });
    }

    return HttpResponse.json(
      {
        id: 'pi_3R2abc123DEF',
        object: 'payment_intent',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
        metadata: { order_id: 'order-001' },
      },
      { status: 200 },
    );
  }),

  http.get('https://api.stripe.com/v1/payment_intents/:id', ({ params }) => {
    const id = params.id as string;
    const statusMap: Record<string, string> = {
      pi_requires_action: 'requires_action',
      pi_processing: 'processing',
      pi_succeeded: 'succeeded',
      pi_canceled: 'canceled',
    };
    const status = statusMap[id] ?? 'succeeded';

    return HttpResponse.json(
      {
        id,
        object: 'payment_intent',
        amount: 2000,
        currency: 'usd',
        status,
        metadata: { order_id: `order-${id}` },
      },
      { status: 200 },
    );
  }),

  http.post('https://api.stripe.com/v1/refunds', ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== 'Bearer sk_test_xyz') {
      return HttpResponse.json({ error: { message: 'Invalid API key' } }, { status: 401 });
    }
    return HttpResponse.json(
      {
        id: 're_test_refund',
        status: 'succeeded',
        amount: 2000,
        currency: 'usd',
      },
      { status: 200 },
    );
  }),
];

const server = setupServer(...handlers);

describe('Stripe Integration', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  describe('createPayment', () => {
    it('sends correct auth header and form-urlencoded body', async () => {
      const res = await gateway.createPayment({
        amount: 2000,
        currency: 'usd',
        referenceId: 'order-001',
      });

      expect(res.transactionId).toBe('pi_3R2abc123DEF');
      expect(res.status).toBe('SUCCESS');
      expect(res.gateway).toBe('stripe');
    });

    it('handles 3DS requires_action with redirectUrl', async () => {
      const gateway3ds = new StripeGateway();
      gateway3ds.initialize({ secretKey: 'sk_test_xyz', debug: false });

      const mockRes = {
        id: 'pi_3R2abc1234DS',
        object: 'payment_intent',
        amount: 5000,
        currency: 'usd',
        status: 'requires_action',
        metadata: { order_id: 'order-3ds-001' },
        next_action: {
          type: 'redirect_to_url',
          redirect_to_url: {
            url: 'https://hooks.stripe.com/3ds/redirect/abc123',
            return_url: 'https://example.com/return',
          },
        },
      };

      const origRequest = (gateway3ds as unknown as { apiRequest: ApiRequestMock }).apiRequest;
      (gateway3ds as unknown as { apiRequest: ApiRequestMock }).apiRequest = async () => ({
        status: 200,
        body: mockRes,
        headers: new Headers(),
      });

      const res = await gateway3ds.createPayment({
        amount: 5000,
        currency: 'usd',
        referenceId: 'order-3ds-001',
      });

      expect(res.status).toBe('PENDING');
      expect(res.redirectUrl).toBe('https://hooks.stripe.com/3ds/redirect/abc123');

      (gateway3ds as unknown as { apiRequest: ApiRequestMock }).apiRequest = origRequest;
    });

    it('throws UnipayError on API error', async () => {
      const badGateway = new StripeGateway();
      badGateway.initialize({ secretKey: 'sk_test_xyz', debug: false });

      const origRequest = (badGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest;
      (badGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest = async () => ({
        status: 402,
        body: {
          error: { type: 'card_error', code: 'card_declined', message: 'Your card was declined.' },
        },
        headers: new Headers(),
      });

      await expect(
        badGateway.createPayment({
          amount: 2000,
          currency: 'usd',
          referenceId: 'order-fail',
        }),
      ).rejects.toThrow(UnipayError);

      (badGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest = origRequest;
    });
  });

  describe('getPaymentStatus', () => {
    it.each([
      ['pi_requires_action', 'PENDING'],
      ['pi_processing', 'PENDING'],
      ['pi_succeeded', 'SUCCESS'],
      ['pi_canceled', 'CANCELED'],
    ])('maps Stripe status %s -> %s', async (txnId, expectedStatus) => {
      const res = await gateway.getPaymentStatus(txnId);
      expect(res.status).toBe(expectedStatus);
      expect(res.transactionId).toBe(txnId);
    });
  });

  describe('refundPayment', () => {
    it('processes refund without amount', async () => {
      const res = await gateway.refundPayment('pi_3R2abc123DEF');
      expect(res.status).toBe('REFUNDED');
      expect(res.transactionId).toBe('re_test_refund');
    });

    it('processes refund with amount', async () => {
      const res = await gateway.refundPayment('pi_3R2abc123DEF', 1000);
      expect(res.status).toBe('REFUNDED');
      expect(res.transactionId).toBe('re_test_refund');
    });

    it('throws UnipayError on refund API error', async () => {
      const badGateway = new StripeGateway();
      badGateway.initialize({ secretKey: 'sk_test_xyz', debug: false });

      const origRequest = (badGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest;
      (badGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest = async () => ({
        status: 400,
        body: { error: { code: 'charge_already_refunded', message: 'Already refunded' } },
        headers: new Headers(),
      });

      await expect(badGateway.refundPayment('pi_123')).rejects.toThrow(UnipayError);

      (badGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest = origRequest;
    });
  });

  describe('getPaymentStatus error', () => {
    it('throws UnipayError on API error', async () => {
      const badGateway = new StripeGateway();
      badGateway.initialize({ secretKey: 'sk_test_xyz', debug: false });

      const origRequest = (badGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest;
      (badGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest = async () => ({
        status: 404,
        body: { error: { code: 'resource_missing', message: 'No such payment_intent' } },
        headers: new Headers(),
      });

      await expect(badGateway.getPaymentStatus('pi_nonexistent')).rejects.toThrow(UnipayError);

      (badGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest = origRequest;
    });
  });

  describe('authenticate', () => {
    it('returns token with Bearer type', async () => {
      const res = await gateway.authenticate();
      expect(res.accessToken).toBe('sk_test_xyz');
      expect(res.tokenType).toBe('Bearer');
      expect(res.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('handleWebhook', () => {
    it('verifies valid webhook signature', async () => {
      const payload = JSON.stringify({
        id: 'evt_test_001',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
        created: 1721234567,
        livemode: false,
        pending_webhooks: 0,
      });

      const signatureHeader = await buildStripeSignature(payload, WEBHOOK_SECRET);

      const result = await gateway.handleWebhook(payload, signatureHeader);
      expect(result.eventType).toBe('payment_intent.succeeded');
      expect(result.transactionId).toBe('pi_123');
    });

    it('rejects invalid webhook signature', async () => {
      const payload = JSON.stringify({
        id: 'evt_test_002',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_456' } },
      });

      const signatureHeader = 't=1234567890,v1=tampered_signature_xyz';

      await expect(gateway.handleWebhook(payload, signatureHeader)).rejects.toThrow(UnipayError);
    });

    it('rejects when signature header has missing fields', async () => {
      const payload = '{}';
      await expect(gateway.handleWebhook(payload, 'invalid-header-format')).rejects.toThrow(
        UnipayError,
      );
    });

    it('throws when webhook secret not configured', async () => {
      const noSecretGateway = new StripeGateway();
      noSecretGateway.initialize({ secretKey: 'sk_test_xyz', debug: false });

      await expect(noSecretGateway.handleWebhook('{}', 'sig')).rejects.toThrow(UnipayError);
    });
  });
});
