import { describe, it, expect } from 'vitest';
import {
  resolveChannelCode,
  toVendorPayload,
  fromVendorResponse,
} from '../../../src/gateways/xendit/mapper.js';
import type { PaymentRequest } from '../../../src/core/types.js';
import type { XenditPaymentRequestStatus } from '../../../src/gateways/xendit/types.js';

describe('Xendit Mapper', () => {
  describe('resolveChannelCode', () => {
    it('returns metadata.channelCode when provided', () => {
      const result = resolveChannelCode({
        amount: 50000,
        currency: 'IDR',
        referenceId: 'order-1',
        metadata: { channelCode: 'ID_BCA' },
      });
      expect(result).toBe('ID_BCA');
    });

    it('maps paymentMethod to channel code', () => {
      expect(
        resolveChannelCode({
          amount: 50000,
          currency: 'IDR',
          referenceId: 'order-1',
          paymentMethod: 'card',
        }),
      ).toBe('CARDS');
      expect(
        resolveChannelCode({
          amount: 50000,
          currency: 'IDR',
          referenceId: 'order-1',
          paymentMethod: 'ewallet',
        }),
      ).toBe('ID_DANA');
      expect(
        resolveChannelCode({
          amount: 50000,
          currency: 'IDR',
          referenceId: 'order-1',
          paymentMethod: 'bank_transfer',
        }),
      ).toBe('ID_BCA');
      expect(
        resolveChannelCode({
          amount: 50000,
          currency: 'IDR',
          referenceId: 'order-1',
          paymentMethod: 'qris',
        }),
      ).toBe('ID_QRIS');
      expect(
        resolveChannelCode({
          amount: 50000,
          currency: 'IDR',
          referenceId: 'order-1',
          paymentMethod: 'va',
        }),
      ).toBe('ID_BCA');
    });

    it('returns default ID_DANA for unknown paymentMethod', () => {
      const result = resolveChannelCode({
        amount: 50000,
        currency: 'IDR',
        referenceId: 'order-1',
        paymentMethod: 'unknown' as string as PaymentRequest['paymentMethod'],
      });
      expect(result).toBe('ID_DANA');
    });

    it('returns default ID_DANA when no paymentMethod', () => {
      const result = resolveChannelCode({
        amount: 50000,
        currency: 'IDR',
        referenceId: 'order-1',
      });
      expect(result).toBe('ID_DANA');
    });
  });

  describe('toVendorPayload', () => {
    it('maps basic request', () => {
      const result = toVendorPayload(
        { amount: 50000, currency: 'IDR', referenceId: 'order-1' },
        'ID_DANA',
      );
      expect(result.reference_id).toBe('order-1');
      expect(result.type).toBe('PAY');
      expect(result.currency).toBe('IDR');
      expect(result.request_amount).toBe(50000);
      expect(result.country).toBe('ID');
      expect(result.channel_code).toBe('ID_DANA');
    });

    it('includes description when provided', () => {
      const result = toVendorPayload(
        { amount: 50000, currency: 'IDR', referenceId: 'order-1', description: 'Test payment' },
        'ID_DANA',
      );
      expect(result.description).toBe('Test payment');
    });

    it('includes customer when provided', () => {
      const result = toVendorPayload(
        {
          amount: 50000,
          currency: 'IDR',
          referenceId: 'order-1',
          customer: { name: 'John Doe', email: 'john@example.com', phone: '08123456789' },
        },
        'ID_DANA',
      );
      expect(result.customer).toEqual({
        given_names: 'John',
        surname: 'Doe',
        email: 'john@example.com',
        mobile_number: '08123456789',
      });
    });

    it('handles customer with single name', () => {
      const result = toVendorPayload(
        {
          amount: 50000,
          currency: 'IDR',
          referenceId: 'order-1',
          customer: { name: 'John' },
        },
        'ID_DANA',
      );
      expect(result.customer).toEqual({ given_names: 'John' });
    });

    it('handles customer with address', () => {
      const result = toVendorPayload(
        {
          amount: 50000,
          currency: 'IDR',
          referenceId: 'order-1',
          customer: {
            name: 'John',
            address: { street: '123 Main St', city: 'Jakarta', postalCode: '12345', country: 'ID' },
          },
        },
        'ID_DANA',
      );
      expect(result.customer).toEqual({
        given_names: 'John',
        address: {
          country: 'ID',
          city: 'Jakarta',
          postal_code: '12345',
          street_line_1: '123 Main St',
        },
      });
    });

    it('handles customer address with default country', () => {
      const result = toVendorPayload(
        {
          amount: 50000,
          currency: 'IDR',
          referenceId: 'order-1',
          customer: {
            name: 'John',
            address: { street: '123 Main St', city: 'Jakarta', postalCode: '12345' },
          },
        },
        'ID_DANA',
      );
      expect((result.customer as Record<string, unknown>)?.address).toEqual({
        country: 'ID',
        city: 'Jakarta',
        postal_code: '12345',
        street_line_1: '123 Main St',
      });
    });

    it('includes items when provided', () => {
      const result = toVendorPayload(
        {
          amount: 100000,
          currency: 'IDR',
          referenceId: 'order-1',
          items: [{ id: '1', name: 'Item 1', price: 50000, quantity: 2, description: 'Desc' }],
        },
        'ID_DANA',
      );
      expect(result.items).toHaveLength(1);
      expect((result.items as Record<string, unknown>[])[0]).toEqual({
        name: 'Item 1',
        price: 50000,
        quantity: 2,
        category: undefined,
        description: 'Desc',
        reference_id: '1',
      });
    });

    it('includes metadata when provided', () => {
      const result = toVendorPayload(
        {
          amount: 50000,
          currency: 'IDR',
          referenceId: 'order-1',
          metadata: { custom: 'value' },
        },
        'ID_DANA',
      );
      expect(result.metadata).toEqual({ custom: 'value' });
    });

    it('includes channel_properties with returnUrl', () => {
      const result = toVendorPayload(
        {
          amount: 50000,
          currency: 'IDR',
          referenceId: 'order-1',
          returnUrl: 'https://example.com/success',
        },
        'ID_DANA',
      );
      expect(result.channel_properties).toEqual({
        success_return_url: 'https://example.com/success',
      });
    });

    it('includes channel_properties with cancelUrl', () => {
      const result = toVendorPayload(
        {
          amount: 50000,
          currency: 'IDR',
          referenceId: 'order-1',
          cancelUrl: 'https://example.com/failure',
        },
        'ID_DANA',
      );
      expect(result.channel_properties).toEqual({
        failure_return_url: 'https://example.com/failure',
      });
    });

    it('includes both returnUrl and cancelUrl', () => {
      const result = toVendorPayload(
        {
          amount: 50000,
          currency: 'IDR',
          referenceId: 'order-1',
          returnUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/failure',
        },
        'ID_DANA',
      );
      expect(result.channel_properties).toEqual({
        success_return_url: 'https://example.com/success',
        failure_return_url: 'https://example.com/failure',
      });
    });

    it('does not include channel_properties when no urls', () => {
      const result = toVendorPayload(
        { amount: 50000, currency: 'IDR', referenceId: 'order-1' },
        'ID_DANA',
      );
      expect(result.channel_properties).toBeUndefined();
    });

    it('uses default country ID when not provided', () => {
      const result = toVendorPayload(
        { amount: 50000, currency: 'IDR', referenceId: 'order-1' },
        'ID_DANA',
      );
      expect(result.country).toBe('ID');
    });

    it('uses provided country', () => {
      const result = toVendorPayload(
        { amount: 50000, currency: 'IDR', referenceId: 'order-1', country: 'PH' },
        'ID_DANA',
      );
      expect(result.country).toBe('PH');
    });
  });

  describe('fromVendorResponse', () => {
    it('maps succeeded status', () => {
      const result = fromVendorResponse({
        id: 'pr_123',
        status: 'SUCCEEDED',
        reference_id: 'order-1',
        request_amount: 50000,
        currency: 'IDR',
        country: 'ID',
        type: 'PAY',
        channel_code: 'ID_DANA',
        created: '2026-07-17T12:00:00Z',
        updated: '2026-07-17T12:00:05Z',
      });
      expect(result.transactionId).toBe('pr_123');
      expect(result.status).toBe('SUCCESS');
    });

    it('maps all statuses', () => {
      const statuses: Record<string, string> = {
        PENDING: 'PENDING',
        REQUIRES_ACTION: 'PENDING',
        ACCEPTING_PAYMENTS: 'PENDING',
        SUCCEEDED: 'SUCCESS',
        FAILED: 'FAILED',
        CANCELED: 'CANCELED',
        EXPIRED: 'EXPIRED',
        AUTHORIZED: 'PENDING',
      };
      for (const [input, expected] of Object.entries(statuses)) {
        const result = fromVendorResponse({
          id: 'pr_123',
          status: input as string as XenditPaymentRequestStatus,
          reference_id: 'order-1',
          request_amount: 50000,
          currency: 'IDR',
          country: 'ID',
          type: 'PAY',
          channel_code: 'ID_DANA',
          created: '2026-07-17T12:00:00Z',
          updated: '2026-07-17T12:00:05Z',
        });
        expect(result.status).toBe(expected);
      }
    });

    it('maps unknown status to PENDING', () => {
      const result = fromVendorResponse({
        id: 'pr_123',
        status: 'UNKNOWN_STATUS' as string as XenditPaymentRequestStatus,
        reference_id: 'order-1',
        request_amount: 50000,
        currency: 'IDR',
        country: 'ID',
        type: 'PAY',
        channel_code: 'ID_DANA',
        created: '2026-07-17T12:00:00Z',
        updated: '2026-07-17T12:00:05Z',
      });
      expect(result.status).toBe('PENDING');
    });

    it('includes failure_code', () => {
      const result = fromVendorResponse({
        id: 'pr_123',
        status: 'FAILED',
        reference_id: 'order-1',
        request_amount: 50000,
        currency: 'IDR',
        country: 'ID',
        type: 'PAY',
        channel_code: 'ID_DANA',
        failure_code: 'INSUFFICIENT_BALANCE',
        created: '2026-07-17T12:00:00Z',
        updated: '2026-07-17T12:00:05Z',
      });
      expect(result.gatewayCode).toBe('INSUFFICIENT_BALANCE');
    });

    it('includes failure_message', () => {
      const result = fromVendorResponse({
        id: 'pr_123',
        status: 'FAILED',
        reference_id: 'order-1',
        request_amount: 50000,
        currency: 'IDR',
        country: 'ID',
        type: 'PAY',
        channel_code: 'ID_DANA',
        failure_message: 'Insufficient balance',
        created: '2026-07-17T12:00:00Z',
        updated: '2026-07-17T12:00:05Z',
      });
      expect(result.gatewayMessage).toBe('Insufficient balance');
    });

    it('extracts REDIRECT_CUSTOMER action', () => {
      const result = fromVendorResponse({
        id: 'pr_123',
        status: 'REQUIRES_ACTION',
        reference_id: 'order-1',
        request_amount: 50000,
        currency: 'IDR',
        country: 'ID',
        type: 'PAY',
        channel_code: 'CARDS',
        actions: [
          { type: 'REDIRECT_CUSTOMER', value: 'https://checkout.xendit.co/redirect/abc123' },
        ],
        created: '2026-07-17T12:00:00Z',
        updated: '2026-07-17T12:00:05Z',
      });
      expect(result.redirectUrl).toBe('https://checkout.xendit.co/redirect/abc123');
    });

    it('returns undefined redirectUrl when no matching action', () => {
      const result = fromVendorResponse({
        id: 'pr_123',
        status: 'SUCCEEDED',
        reference_id: 'order-1',
        request_amount: 50000,
        currency: 'IDR',
        country: 'ID',
        type: 'PAY',
        channel_code: 'ID_DANA',
        actions: [{ type: 'OTHER_ACTION', value: 'https://example.com' }],
        created: '2026-07-17T12:00:00Z',
        updated: '2026-07-17T12:00:05Z',
      });
      expect(result.redirectUrl).toBeUndefined();
    });

    it('returns undefined redirectUrl when no actions', () => {
      const result = fromVendorResponse({
        id: 'pr_123',
        status: 'SUCCEEDED',
        reference_id: 'order-1',
        request_amount: 50000,
        currency: 'IDR',
        country: 'ID',
        type: 'PAY',
        channel_code: 'ID_DANA',
        created: '2026-07-17T12:00:00Z',
        updated: '2026-07-17T12:00:05Z',
      });
      expect(result.redirectUrl).toBeUndefined();
    });
  });
});
