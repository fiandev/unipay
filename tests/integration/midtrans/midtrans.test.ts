import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MidtransGateway } from '../../../src/gateways/midtrans/index.js';
import { UnipayError } from '../../../src/core/errors.js';
import { sha512Hex } from '../../../src/core/signature/index.js';

const SERVER_KEY = 'Midtrans-server-key-abc123';

const gateway = new MidtransGateway();
gateway.initialize({
  serverKey: SERVER_KEY,
  isProduction: false,
  debug: false,
});

type ApiRequestMock = (
  url?: string,
  opts?: { headers?: Record<string, string>; body?: Record<string, unknown> },
) => Promise<{ status: number; body: unknown; headers: Headers }>;

const handlers = [
  http.post('https://api.sandbox.midtrans.com/v2/charge', async ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Basic ')) {
      return HttpResponse.json(
        { status_code: '401', status_message: 'Unauthorized' },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const paymentType = body.payment_type as string;

    if (paymentType === 'bank_transfer') {
      return HttpResponse.json(
        {
          status_code: '201',
          status_message: 'Success, Bank Transfer transaction is created',
          transaction_id: 'trx-bt-001',
          order_id: body.transaction_details?.['order_id'] ?? '',
          gross_amount: String(body.transaction_details?.['gross_amount'] ?? 0),
          payment_type: 'bank_transfer',
          transaction_time: '2026-07-17T12:00:00Z',
          transaction_status: 'pending',
          va_numbers: [{ bank: 'bca', va_number: '12345678901' }],
        },
        { status: 201 },
      );
    }

    if (paymentType === 'gopay') {
      return HttpResponse.json(
        {
          status_code: '201',
          status_message: 'Success, GoPay transaction is created',
          transaction_id: 'trx-gopay-001',
          order_id: body.transaction_details?.['order_id'] ?? '',
          gross_amount: String(body.transaction_details?.['gross_amount'] ?? 0),
          payment_type: 'gopay',
          transaction_time: '2026-07-17T12:00:00Z',
          transaction_status: 'pending',
          actions: [
            {
              name: 'generate-qr-code',
              method: 'GET',
              url: 'https://api.midtrans.com/v2/gopay/123/qr-code',
            },
            { name: 'deeplink-redirect', method: 'GET', url: 'https://gojek.com/redirect/123' },
          ],
        },
        { status: 201 },
      );
    }

    return HttpResponse.json(
      {
        status_code: '201',
        status_message: 'Success, transaction is created',
        transaction_id: 'trx-default-001',
        order_id: body.transaction_details?.['order_id'] ?? '',
        gross_amount: String(body.transaction_details?.['gross_amount'] ?? 0),
        payment_type: paymentType,
        transaction_time: '2026-07-17T12:00:00Z',
        transaction_status: 'pending',
      },
      { status: 201 },
    );
  }),

  http.get('https://api.sandbox.midtrans.com/v2/:orderId/status', ({ params }) => {
    const orderId = params.orderId as string;

    const statusMap: Record<string, { transaction_status: string; fraud_status?: string }> = {
      'order-pending': { transaction_status: 'pending' },
      'order-settlement': { transaction_status: 'settlement', fraud_status: 'accept' },
      'order-deny': { transaction_status: 'deny' },
      'order-cancel': { transaction_status: 'cancel' },
      'order-expire': { transaction_status: 'expire' },
    };

    const statusData = statusMap[orderId] ?? { transaction_status: 'pending' };

    return HttpResponse.json(
      {
        status_code: '200',
        status_message: 'Success, transaction found',
        transaction_id: `trx-${orderId}`,
        order_id: orderId,
        gross_amount: '100000.00',
        payment_type: 'bank_transfer',
        transaction_time: '2026-07-17T12:00:00Z',
        transaction_status: statusData.transaction_status,
        fraud_status: statusData.fraud_status,
      },
      { status: 200 },
    );
  }),

  http.post('https://api.sandbox.midtrans.com/v2/:orderId/refund', () => {
    return HttpResponse.json(
      {
        status_code: '200',
        status_message: 'Success, transaction refunded',
        transaction_id: 'trx-refund-001',
        order_id: 'order-refund-001',
        gross_amount: '50000.00',
        payment_type: 'bank_transfer',
        transaction_time: '2026-07-17T12:00:00Z',
        transaction_status: 'refund',
      },
      { status: 200 },
    );
  }),
];

const server = setupServer(...handlers);

describe('Midtrans Integration', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  describe('createPayment', () => {
    it('sends correct Basic auth header and bank_transfer payload', async () => {
      const res = await gateway.createPayment({
        amount: 100000,
        currency: 'IDR',
        referenceId: 'order-bt-001',
        paymentMethod: 'bank_transfer',
        bank: 'bca',
      });

      expect(res.transactionId).toBe('trx-bt-001');
      expect(res.status).toBe('PENDING');
      expect(res.gateway).toBe('midtrans');
    });

    it('sends gopay payload with callback_url from request', async () => {
      const res = await gateway.createPayment({
        amount: 50000,
        currency: 'IDR',
        referenceId: 'order-gopay-001',
        paymentMethod: 'ewallet',
        callbackUrl: 'https://example.com/callback',
      });

      expect(res.transactionId).toBe('trx-gopay-001');
      expect(res.status).toBe('PENDING');
    });

    it('includes transaction_details.order_id and gross_amount', async () => {
      const testGateway = new MidtransGateway();
      testGateway.initialize({ serverKey: SERVER_KEY, isProduction: false, debug: false });

      const capturedBodies: Record<string, unknown>[] = [];
      const origRequest = (testGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest;
      (testGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest = async (
        _url: string,
        opts: { body?: Record<string, unknown> },
      ) => {
        capturedBodies.push(opts.body ?? {});
        return {
          status: 201,
          body: {
            status_code: '201',
            status_message: 'Success',
            transaction_id: 'trx-capture-001',
            order_id: 'order-capture-001',
            gross_amount: '75000.00',
            payment_type: 'bank_transfer',
            transaction_time: '2026-07-17T12:00:00Z',
            transaction_status: 'pending',
          },
          headers: new Headers(),
        };
      };

      await testGateway.createPayment({
        amount: 75000,
        currency: 'IDR',
        referenceId: 'order-capture-001',
        paymentMethod: 'bank_transfer',
        bank: 'bca',
      });

      expect(capturedBodies.length).toBe(1);
      expect(capturedBodies[0]?.['transaction_details']).toEqual({
        order_id: 'order-capture-001',
        gross_amount: 75000,
      });

      (testGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest = origRequest;
    });

    it('throws UnipayError on API error', async () => {
      const badGateway = new MidtransGateway();
      badGateway.initialize({ serverKey: SERVER_KEY, isProduction: false, debug: false });

      const origRequest = (badGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest;
      (badGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest = async () => ({
        status: 400,
        body: { status_code: '400', status_message: 'Transaction amount exceeds limit' },
        headers: new Headers(),
      });

      await expect(
        badGateway.createPayment({
          amount: 999999999,
          currency: 'IDR',
          referenceId: 'order-fail',
        }),
      ).rejects.toThrow(UnipayError);

      (badGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest = origRequest;
    });
  });

  describe('getPaymentStatus', () => {
    it.each([
      ['order-pending', 'PENDING'],
      ['order-settlement', 'SUCCESS'],
      ['order-deny', 'FAILED'],
      ['order-cancel', 'CANCELED'],
      ['order-expire', 'EXPIRED'],
    ])('maps Midtrans status for %s -> %s', async (orderId, expectedStatus) => {
      const res = await gateway.getPaymentStatus(orderId);
      expect(res.status).toBe(expectedStatus);
      expect(res.transactionId).toBe(`trx-${orderId}`);
    });
  });

  describe('refundPayment', () => {
    it('processes refund', async () => {
      const res = await gateway.refundPayment('order-refund-001');
      expect(res.status).toBe('REFUNDED');
      expect(res.transactionId).toBe('trx-refund-001');
    });
  });

  describe('handleWebhook', () => {
    // based on common Midtrans Core API v2 pattern, re-validate during real sandbox integration
    it('verifies valid webhook signature', async () => {
      const payload = {
        transaction_time: '2026-07-17T12:00:00Z',
        transaction_status: 'settlement',
        transaction_id: 'trx-webhook-001',
        status_message: 'Success',
        status_code: '200',
        signature_key: '',
        payment_type: 'credit_card',
        order_id: 'order-webhook-001',
        gross_amount: '100000.00',
        fraud_status: 'accept',
      };

      const rawString = `${payload.order_id}${payload.status_code}${payload.gross_amount}${SERVER_KEY}`;
      payload.signature_key = await sha512Hex(rawString);

      const payloadStr = JSON.stringify(payload);

      const result = await gateway.handleWebhook(payloadStr);
      expect(result.eventType).toBe('settlement');
      expect(result.transactionId).toBe('trx-webhook-001');
    });

    it('rejects invalid webhook signature', async () => {
      const payload = JSON.stringify({
        transaction_time: '2026-07-17T12:00:00Z',
        transaction_status: 'settlement',
        transaction_id: 'trx-webhook-002',
        status_message: 'Success',
        status_code: '200',
        signature_key: 'tampered_signature_xyz',
        payment_type: 'credit_card',
        order_id: 'order-webhook-002',
        gross_amount: '100000.00',
      });

      await expect(gateway.handleWebhook(payload)).rejects.toThrow(UnipayError);
    });
  });
});
