import { describe, it, expect } from 'vitest';
import {
  toVendorPayload,
  resolvePaymentType,
  fromChargeResponse,
  fromStatusResponse,
} from '../../../src/gateways/midtrans/mapper.js';
import type {
  MidtransChargeResponse,
  MidtransStatusResponse,
  MidtransFraudStatus,
  MidtransTransactionStatus,
} from '../../../src/gateways/midtrans/types.js';

function chargeResponse(overrides: Partial<MidtransChargeResponse> = {}): MidtransChargeResponse {
  return {
    status_code: '200',
    status_message: 'Success',
    transaction_id: 'trx-1',
    order_id: 'order-1',
    gross_amount: '100000.00',
    payment_type: 'bank_transfer',
    transaction_time: '2026-07-17T12:00:00Z',
    transaction_status: 'pending',
    ...overrides,
  };
}

function statusResponse(overrides: Partial<MidtransStatusResponse> = {}): MidtransStatusResponse {
  return {
    status_code: '200',
    status_message: 'Success',
    transaction_id: 'trx-1',
    order_id: 'order-1',
    gross_amount: '100000.00',
    payment_type: 'bank_transfer',
    transaction_time: '2026-07-17T12:00:00Z',
    transaction_status: 'pending',
    ...overrides,
  };
}

describe('Midtrans Mapper', () => {
  describe('resolvePaymentType', () => {
    it.each([
      ['bank_transfer', 'bank_transfer'],
      ['va', 'bank_transfer'],
      ['ewallet', 'gopay'],
      ['card', 'credit_card'],
      [undefined, 'bank_transfer'],
      ['unknown', 'bank_transfer'],
    ])('maps %s -> %s', (input, expected) => {
      expect(resolvePaymentType(input)).toBe(expected);
    });
  });

  describe('toVendorPayload', () => {
    it('maps bank_transfer with default bank', () => {
      const result = toVendorPayload(
        { amount: 100000, currency: 'IDR', referenceId: 'order-1' },
        'bank_transfer',
      );
      expect(result.payment_type).toBe('bank_transfer');
      expect(result.bank_transfer).toEqual({ bank: 'bca' });
    });

    it('maps bank_transfer with custom bank', () => {
      const result = toVendorPayload(
        { amount: 100000, currency: 'IDR', referenceId: 'order-1', bank: 'bni' },
        'bank_transfer',
      );
      expect(result.bank_transfer).toEqual({ bank: 'bni' });
    });

    it('maps bank_transfer with va_number in metadata', () => {
      const result = toVendorPayload(
        {
          amount: 100000,
          currency: 'IDR',
          referenceId: 'order-1',
          metadata: { vaNumber: '123456' },
        },
        'bank_transfer',
      );
      expect(result.bank_transfer?.va_number).toBe('123456');
    });

    it('maps gopay with callback_url', () => {
      const result = toVendorPayload(
        {
          amount: 50000,
          currency: 'IDR',
          referenceId: 'order-2',
          callbackUrl: 'https://example.com',
        },
        'gopay',
      );
      expect(result.gopay).toEqual({ enable_callback: true, callback_url: 'https://example.com' });
    });

    it('throws for credit_card without tokenId', () => {
      expect(() =>
        toVendorPayload({ amount: 100000, currency: 'IDR', referenceId: 'order-3' }, 'credit_card'),
      ).toThrow('tokenId is required for credit_card payment_type');
    });

    it('maps credit_card with tokenId', () => {
      const result = toVendorPayload(
        { amount: 100000, currency: 'IDR', referenceId: 'order-3', tokenId: 'tok_123' },
        'credit_card',
      );
      expect(result.credit_card).toEqual({ token_id: 'tok_123' });
    });

    it('includes items when provided', () => {
      const result = toVendorPayload(
        {
          amount: 100000,
          currency: 'IDR',
          referenceId: 'order-1',
          items: [{ id: '1', name: 'Item 1', price: 50000, quantity: 2 }],
        },
        'bank_transfer',
      );
      expect(result.item_details).toHaveLength(1);
      expect(result.item_details?.[0]).toEqual({
        id: '1',
        name: 'Item 1',
        price: 50000,
        quantity: 2,
        category: undefined,
      });
    });

    it('includes customer_details when provided', () => {
      const result = toVendorPayload(
        {
          amount: 100000,
          currency: 'IDR',
          referenceId: 'order-1',
          customer: { name: 'John Doe', email: 'john@example.com', phone: '08123456789' },
        },
        'bank_transfer',
      );
      expect(result.customer_details).toEqual({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '08123456789',
      });
    });

    it('handles customer with single name', () => {
      const result = toVendorPayload(
        {
          amount: 100000,
          currency: 'IDR',
          referenceId: 'order-1',
          customer: { name: 'John' },
        },
        'bank_transfer',
      );
      expect(result.customer_details?.first_name).toBe('John');
      expect(result.customer_details?.last_name).toBeUndefined();
    });

    it('handles customer with address', () => {
      const result = toVendorPayload(
        {
          amount: 100000,
          currency: 'IDR',
          referenceId: 'order-1',
          customer: {
            name: 'John',
            address: { street: '123 Main St', city: 'Jakarta', postalCode: '12345', country: 'ID' },
          },
        },
        'bank_transfer',
      );
      expect(result.customer_details?.billing_address).toEqual({
        address: '123 Main St',
        city: 'Jakarta',
        postal_code: '12345',
        country_code: 'ID',
      });
      expect(result.customer_details?.shipping_address).toEqual(
        result.customer_details?.billing_address,
      );
    });
  });

  describe('fromChargeResponse', () => {
    it('maps pending status', () => {
      const result = fromChargeResponse(
        chargeResponse({ transaction_status: 'pending' }),
        'order-1',
      );
      expect(result.status).toBe('PENDING');
    });

    it('maps settlement with accept fraud', () => {
      const result = fromChargeResponse(
        chargeResponse({ transaction_status: 'settlement', fraud_status: 'accept' }),
        'order-1',
      );
      expect(result.status).toBe('SUCCESS');
    });

    it('maps settlement without fraud_status', () => {
      const result = fromChargeResponse(
        chargeResponse({ transaction_status: 'settlement' }),
        'order-1',
      );
      expect(result.status).toBe('SUCCESS');
    });

    it('maps settlement with deny fraud', () => {
      const result = fromChargeResponse(
        chargeResponse({ transaction_status: 'settlement', fraud_status: 'deny' }),
        'order-1',
      );
      expect(result.status).toBe('FAILED');
    });

    it('maps settlement with challenge fraud', () => {
      const result = fromChargeResponse(
        chargeResponse({ transaction_status: 'settlement', fraud_status: 'challenge' }),
        'order-1',
      );
      expect(result.status).toBe('FAILED');
    });

    it('maps settlement with unknown fraud to PENDING', () => {
      const result = fromChargeResponse(
        chargeResponse({
          transaction_status: 'settlement',
          fraud_status: 'unknown' as string as MidtransFraudStatus,
        }),
        'order-1',
      );
      expect(result.status).toBe('PENDING');
    });

    it('maps capture with accept fraud', () => {
      const result = fromChargeResponse(
        chargeResponse({ transaction_status: 'capture', fraud_status: 'accept' }),
        'order-1',
      );
      expect(result.status).toBe('SUCCESS');
    });

    it('maps deny status', () => {
      const result = fromChargeResponse(chargeResponse({ transaction_status: 'deny' }), 'order-1');
      expect(result.status).toBe('FAILED');
    });

    it('maps cancel status', () => {
      const result = fromChargeResponse(
        chargeResponse({ transaction_status: 'cancel' }),
        'order-1',
      );
      expect(result.status).toBe('CANCELED');
    });

    it('maps expire status', () => {
      const result = fromChargeResponse(
        chargeResponse({ transaction_status: 'expire' }),
        'order-1',
      );
      expect(result.status).toBe('EXPIRED');
    });

    it('maps refund status', () => {
      const result = fromChargeResponse(
        chargeResponse({ transaction_status: 'refund' }),
        'order-1',
      );
      expect(result.status).toBe('FAILED');
    });

    it('maps unknown status to PENDING', () => {
      const result = fromChargeResponse(
        chargeResponse({ transaction_status: 'unknown' as string as MidtransTransactionStatus }),
        'order-1',
      );
      expect(result.status).toBe('PENDING');
    });

    it('extracts redirect action', () => {
      const result = fromChargeResponse(
        chargeResponse({
          transaction_status: 'pending',
          actions: [
            { name: 'deeplink', method: 'POST', url: 'https://example.com/deeplink' },
            { name: 'redirect', method: 'GET', url: 'https://example.com/redirect' },
          ],
        }),
        'order-1',
      );
      expect(result.redirectUrl).toBe('https://example.com/redirect');
    });

    it('extracts action with GET method', () => {
      const result = fromChargeResponse(
        chargeResponse({
          transaction_status: 'pending',
          actions: [{ name: 'deeplink', method: 'GET', url: 'https://example.com/deeplink' }],
        }),
        'order-1',
      );
      expect(result.redirectUrl).toBe('https://example.com/deeplink');
    });

    it('returns undefined redirectUrl when no actions', () => {
      const result = fromChargeResponse(
        chargeResponse({ transaction_status: 'pending' }),
        'order-1',
      );
      expect(result.redirectUrl).toBeUndefined();
    });
  });

  describe('fromStatusResponse', () => {
    it('maps status correctly', () => {
      const result = fromStatusResponse(
        statusResponse({ transaction_status: 'settlement' }),
        'order-1',
      );
      expect(result.status).toBe('SUCCESS');
      expect(result.transactionId).toBe('trx-1');
    });
  });
});
