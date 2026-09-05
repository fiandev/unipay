/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnipayError } from '../../../src/core/errors.js';

const mockStripeVerify = vi.fn();
const mockXenditVerify = vi.fn();
const mockMidtransVerify = vi.fn();
const mockDokuVerify = vi.fn();

vi.mock('../../../src/gateways/stripe/webhook.js', () => ({
  verifyStripeWebhook: mockStripeVerify,
}));
vi.mock('../../../src/gateways/xendit/webhook.js', () => ({
  verifyXenditWebhook: mockXenditVerify,
}));
vi.mock('../../../src/gateways/midtrans/webhook.js', () => ({
  verifyMidtransWebhook: mockMidtransVerify,
}));
vi.mock('../../../src/gateways/doku/webhook.js', () => ({
  verifyDokuWebhook: mockDokuVerify,
}));

const { verifyWebhook } = await import('../../../src/webhooks/verify.js');

function validResult() {
  return { eventType: 'payment.success', transactionId: 'txn_001', raw: { id: 'txn_001' } };
}

describe('verifyWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStripeVerify.mockResolvedValue(validResult());
    mockXenditVerify.mockReturnValue(validResult());
    mockMidtransVerify.mockResolvedValue(validResult());
    mockDokuVerify.mockResolvedValue(validResult());
  });

  describe('valid signatures', () => {
    it('verifies Stripe webhook and returns verified: true', async () => {
      const result = await verifyWebhook(
        'stripe',
        '{"type":"payment_intent.succeeded"}',
        { 'stripe-signature': 't=123,v1=sig' },
        'whsec_test',
      );

      expect(result.verified).toBe(true);
      expect(result.gateway).toBe('stripe');
      expect(result.eventType).toBe('payment.success');
      expect(result.transactionId).toBe('txn_001');
      expect(mockStripeVerify).toHaveBeenCalledOnce();
    });

    it('verifies Xendit webhook and returns verified: true', async () => {
      const result = await verifyWebhook(
        'xendit',
        '{"event":"payment.succeeded"}',
        { 'x-callback-token': 'valid-token' },
        'valid-token',
      );

      expect(result.verified).toBe(true);
      expect(result.gateway).toBe('xendit');
      expect(mockXenditVerify).toHaveBeenCalledOnce();
    });

    it('verifies Midtrans webhook and returns verified: true', async () => {
      const result = await verifyWebhook(
        'midtrans',
        '{"order_id":"ORD-001","status_code":"200","gross_amount":"10000","signature_key":"abc"}',
        {},
        'server-key',
      );

      expect(result.verified).toBe(true);
      expect(result.gateway).toBe('midtrans');
      expect(mockMidtransVerify).toHaveBeenCalledOnce();
    });

    it('verifies Doku webhook and returns verified: true', async () => {
      const result = await verifyWebhook(
        'doku',
        '{"partnerReferenceNo":"REF-001"}',
        { 'x-signature': 'hmac-sig' },
        'secret-key',
      );

      expect(result.verified).toBe(true);
      expect(result.gateway).toBe('doku');
      expect(mockDokuVerify).toHaveBeenCalledOnce();
    });
  });

  describe('invalid signatures (throwOnInvalid: true, default)', () => {
    async function assertThrowsInvalid(gateway: 'stripe' | 'xendit' | 'midtrans' | 'doku') {
      mockStripeVerify.mockReset();
      const err = new UnipayError({
        code: 'WEBHOOK_SIGNATURE_INVALID',
        message: 'Signature mismatch',
      });

      switch (gateway) {
        case 'stripe':
          mockStripeVerify.mockRejectedValue(err);
          break;
        case 'xendit':
          mockXenditVerify.mockImplementation(() => {
            throw err;
          });
          break;
        case 'midtrans':
          mockMidtransVerify.mockRejectedValue(err);
          break;
        case 'doku':
          mockDokuVerify.mockRejectedValue(err);
          break;
      }
    }

    it('throws on invalid Stripe signature', async () => {
      await assertThrowsInvalid('stripe');
      await expect(
        verifyWebhook('stripe', '{}', { 'stripe-signature': 'bad' }, 'whsec_test'),
      ).rejects.toThrow(UnipayError);
      await expect(
        verifyWebhook('stripe', '{}', { 'stripe-signature': 'bad' }, 'whsec_test'),
      ).rejects.toMatchObject({ code: 'WEBHOOK_SIGNATURE_INVALID' });
    });

    it('throws on invalid Xendit signature', async () => {
      await assertThrowsInvalid('xendit');
      await expect(
        verifyWebhook('xendit', '{}', { 'x-callback-token': 'wrong' }, 'expected'),
      ).rejects.toThrow(UnipayError);
      await expect(
        verifyWebhook('xendit', '{}', { 'x-callback-token': 'wrong' }, 'expected'),
      ).rejects.toMatchObject({ code: 'WEBHOOK_SIGNATURE_INVALID' });
    });

    it('throws on invalid Midtrans signature', async () => {
      await assertThrowsInvalid('midtrans');
      await expect(verifyWebhook('midtrans', '{}', {}, 'server-key')).rejects.toThrow(UnipayError);
      await expect(verifyWebhook('midtrans', '{}', {}, 'server-key')).rejects.toMatchObject({
        code: 'WEBHOOK_SIGNATURE_INVALID',
      });
    });

    it('throws on invalid Doku signature', async () => {
      await assertThrowsInvalid('doku');
      await expect(
        verifyWebhook('doku', '{}', { 'x-signature': 'wrong' }, 'secret'),
      ).rejects.toThrow(UnipayError);
      await expect(
        verifyWebhook('doku', '{}', { 'x-signature': 'wrong' }, 'secret'),
      ).rejects.toMatchObject({ code: 'WEBHOOK_SIGNATURE_INVALID' });
    });
  });

  describe('throwOnInvalid: false', () => {
    it('returns WebhookEvent with verified: false on invalid signature', async () => {
      mockStripeVerify.mockRejectedValue(
        new UnipayError({ code: 'WEBHOOK_SIGNATURE_INVALID', message: 'bad' }),
      );

      const result = await verifyWebhook(
        'stripe',
        '{}',
        { 'stripe-signature': 'bad' },
        'whsec_test',
        { throwOnInvalid: false },
      );

      expect(result.verified).toBe(false);
      expect(result.gateway).toBe('stripe');
    });
  });

  describe('unknown gateway', () => {
    it('throws VALIDATION_ERROR for unknown gateway', async () => {
      await expect(
        verifyWebhook('unknown-gateway' as never, '{}', {}, 'secret'),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });

  describe('payload type handling', () => {
    it('accepts Buffer payload', async () => {
      const buf = Buffer.from('{"type":"payment_intent.succeeded"}', 'utf-8');
      const result = await verifyWebhook(
        'stripe',
        buf,
        { 'stripe-signature': 't=123,v1=sig' },
        'whsec_test',
      );
      expect(result.verified).toBe(true);
    });
  });

  describe('non-webhook errors propagate', () => {
    it('re-throws unexpected errors that are not WEBHOOK_SIGNATURE_INVALID', async () => {
      mockStripeVerify.mockRejectedValue(new Error('Network failure'));
      await expect(
        verifyWebhook('stripe', '{}', { 'stripe-signature': 'sig' }, 'whsec_test'),
      ).rejects.toThrow('Network failure');
    });
  });
});
