import { describe, it, expect } from 'vitest';
import { toVendorPayload, fromVendorResponse } from '../../../src/gateways/stripe/mapper.js';
import type { StripePaymentIntent } from '../../../src/gateways/stripe/types.js';

function paymentIntent(overrides: Partial<StripePaymentIntent> = {}): StripePaymentIntent {
  return {
    id: 'pi_123',
    object: 'payment_intent',
    amount: 1000,
    currency: 'usd',
    status: 'succeeded',
    metadata: {},
    ...overrides,
  };
}

describe('Stripe Mapper', () => {
  describe('toVendorPayload', () => {
    it('maps basic request', () => {
      const result = toVendorPayload({
        amount: 1000,
        currency: 'USD',
        referenceId: 'order-1',
      });
      expect(result.amount).toBe('1000');
      expect(result.currency).toBe('usd');
      expect(result['metadata[order_id]']).toBe('order-1');
    });

    it('includes description when provided', () => {
      const result = toVendorPayload({
        amount: 1000,
        currency: 'USD',
        referenceId: 'order-1',
        description: 'Test payment',
      });
      expect(result.description).toBe('Test payment');
    });

    it('sets payment_method_types for card', () => {
      const result = toVendorPayload({
        amount: 1000,
        currency: 'USD',
        referenceId: 'order-1',
        paymentMethod: 'card',
      });
      expect(result['payment_method_types[]']).toBe('card');
    });

    it('sets automatic_payment_methods when no paymentMethod', () => {
      const result = toVendorPayload({
        amount: 1000,
        currency: 'USD',
        referenceId: 'order-1',
      });
      expect(result['automatic_payment_methods[enabled]']).toBe('true');
    });

    it('includes customer email', () => {
      const result = toVendorPayload({
        amount: 1000,
        currency: 'USD',
        referenceId: 'order-1',
        customer: { email: 'test@example.com' },
      });
      expect(result.receipt_email).toBe('test@example.com');
    });

    it('includes customer name in metadata', () => {
      const result = toVendorPayload({
        amount: 1000,
        currency: 'USD',
        referenceId: 'order-1',
        customer: { name: 'John Doe' },
      });
      expect(result['metadata[customer_name]']).toBe('John Doe');
    });

    it('includes returnUrl', () => {
      const result = toVendorPayload({
        amount: 1000,
        currency: 'USD',
        referenceId: 'order-1',
        returnUrl: 'https://example.com/return',
      });
      expect(result['return_url']).toBe('https://example.com/return');
    });
  });

  describe('fromVendorResponse', () => {
    it('maps succeeded status', () => {
      const result = fromVendorResponse(
        paymentIntent({ id: 'pi_123', status: 'succeeded' }),
        'stripe',
      );
      expect(result.transactionId).toBe('pi_123');
      expect(result.status).toBe('SUCCESS');
    });

    it('maps pending statuses', () => {
      const statuses = [
        'requires_payment_method',
        'requires_confirmation',
        'requires_action',
        'processing',
      ] as const;
      for (const status of statuses) {
        const result = fromVendorResponse(paymentIntent({ id: 'pi_123', status }), 'stripe');
        expect(result.status).toBe('PENDING');
      }
    });

    it('maps canceled status', () => {
      const result = fromVendorResponse(
        paymentIntent({ id: 'pi_123', status: 'canceled' }),
        'stripe',
      );
      expect(result.status).toBe('CANCELED');
    });

    it('maps unknown status to PENDING', () => {
      const result = fromVendorResponse(
        paymentIntent({
          id: 'pi_123',
          status: 'unknown_status' as string as StripePaymentIntent['status'],
        }),
        'stripe',
      );
      expect(result.status).toBe('PENDING');
    });

    it('includes last_payment_error', () => {
      const result = fromVendorResponse(
        paymentIntent({
          id: 'pi_123',
          status: 'succeeded',
          last_payment_error: {
            type: 'card_error',
            code: 'card_declined',
            message: 'Card declined',
          },
        }),
        'stripe',
      );
      expect(result.gatewayCode).toBe('card_declined');
      expect(result.gatewayMessage).toBe('Card declined');
    });

    it('includes redirectUrl for requires_action with next_action', () => {
      const result = fromVendorResponse(
        paymentIntent({
          id: 'pi_123',
          status: 'requires_action',
          next_action: {
            type: 'redirect_to_url',
            redirect_to_url: { url: 'https://example.com/3ds', return_url: 'https://example.com' },
          },
        }),
        'stripe',
      );
      expect(result.redirectUrl).toBe('https://example.com/3ds');
    });

    it('does not include redirectUrl when status is not requires_action', () => {
      const result = fromVendorResponse(
        paymentIntent({
          id: 'pi_123',
          status: 'succeeded',
          next_action: {
            type: 'redirect_to_url',
            redirect_to_url: { url: 'https://example.com/3ds', return_url: 'https://example.com' },
          },
        }),
        'stripe',
      );
      expect(result.redirectUrl).toBeUndefined();
    });
  });
});
