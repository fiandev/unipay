/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { DokuGateway } from '../../../src/gateways/doku/index.js';
import { UnipayError } from '../../../src/core/errors.js';

const CLIENT_ID = 'doku-client-id';
const SECRET_KEY = 'doku-secret-key';
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDE3tOcV9cjTNxo
BgU4qzI4tJ9eg8EOFqQLVbtxLbDpSTgqvqEDzoOwvks/zcSPVsGWed54c5rYT7u3
dLaE4omwzt6SWYIAwC9rT6FtcObEeqQW03fF59Nrtb6Mhzf6IezBiE5vrhBQb03P
pbLZZqEpLk2n1G//W3tUq5t5OFc0aroaiwcePAJ6rFsXX+EtUz+tB/kZmdAsMdUh
FNUE5Yt54w8GC68SM+BNQxsYPW9tMSQFhwZWe9/ByUGJHZFm+Qw7/x9XDL5VHbLc
DKvfpzz1VSw2uAeG/pwpFWtzUOZ58vkydCaXtDcB3lQF3fcctuT1H0UnmK6R++sI
AHnWZmKRAgMBAAECggEATT8tgvQIi2ZWOU7bb5/k5dEhk2FZN+D0Xyo1kTQfbXn4
WvVPkoHOtGQGfLONg7zD2vpYq6SYxnWKr3JRR5Tn+AND2+LZGthOAupM6fdZ5RBG
IFq7bWEIWQQID3XjJfd3wXxtYm7HIfh6bJaUta8KX3E2sTqu82B+5Pss1wSfWwYx
SMnZzV4SDO7LEDDALYqC27HFoH6J54A6ET6qEFOu4gsvtxUYVjJBSU8KyIvjeaP1
nudDV0heNeNOC7Bgzldc64xOISXvm88WIlDl16siybpQPrM5lLEXXTYXssSQGo5i
uTk9eIbJbEROqFOrNK5ki0x8sYjcGdchdQsz5tCU3QKBgQDqJNofLQi+xfRPFvFT
y4Ua9v0YWuk33mnGac+SbRpNAn+o2nm6W3I0ba17WJoSD/Vk1XHrAAz9HTIiFkOE
VUOcYhtfu/Uk8MtCZCBUhDZcYwht+Z7o2wrfpbZ+Y6ER9T4vh6tmG9BJmf9WNEDV
NMGU66Ge+I6QuoGahK6XKp8x4wKBgQDXP0d0LhaHhXFf2F+nz3c61vLIbnLZLAqu
uO+NU8q79JNBq+VEeQIMIBdmbiCpYJ+x+oEZZp+SWd7uUcQicinryQh6CKjKFe/s
Jhm3QDGMEorsj3kveh6GC3mOqq2Pxqexm+5n4mCbl70dSoR1PP2DeBf52QKsdD3D
dv+lOhLz+wKBgC0yvfRkshp5hga6bA177Q7efM71xa1mPs7xYANpEjmpcNE8k2D5
BBvAzEtSODOiZwF2/o2ZregyeZoA6DmkZ+/JNHWPh+wAm4wOXftSplfBOkBYfmd+
2SOBDrBpNQ+NYtqz+s80MUnz80lFvvopO/EuZz2Tx5mCl0Anurgtnxt3AoGAY7Jg
kzRhpQWu3JjovV4/uFYk/6cAtQxMKl9oPUqJRYNjzXAj8hImW51lmUD7CdjCPvpr
X2uED5JmynW+5cGBHz/vGC74lxmQFg4TrSgjiuBvzmAp3k6u4qFf/S+a0lROCdrS
kvVsj8S5iF6ieXb1aTZvzH6yWVRB404z3MDIVI8CgYBllQqh1KeiiaxbCFwlGZNe
PpYKk+fXGogP9s+dXbpVmAzeY7kI3PlnlDAm4xebln5qAcZNGccEl+ro2MhN3/Pw
C2k3XGxJzsn1UPEXSXQ+5X7XUvt4bpG+wm+mStCHjifYGW9ZOFlplFJ1gVKlMtQt
Bl7874DbtK3n0O2eUbLeqA==
-----END PRIVATE KEY-----`;

const gateway = new DokuGateway();
gateway.initialize({
  clientId: CLIENT_ID,
  secretKey: SECRET_KEY,
  privateKey: PRIVATE_KEY,
  isProduction: false,
  debug: false,
});

type ApiRequestMock = (
  url?: string,
  opts?: { headers?: Record<string, string>; body?: Record<string, unknown> },
) => Promise<{ status: number; body: unknown; headers: Headers }>;

const handlers = [
  http.post(
    'https://api-sandbox.doku.com/authorization/v1/access-token/b2b',
    async ({ request }) => {
      const signature = request.headers.get('X-SIGNATURE');
      const timestamp = request.headers.get('X-TIMESTAMP');
      const clientKey = request.headers.get('X-CLIENT-KEY');

      if (!signature || !timestamp || clientKey !== CLIENT_ID) {
        return HttpResponse.json(
          { responseCode: '4007300', responseMessage: 'Invalid client' },
          { status: 401 },
        );
      }

      return HttpResponse.json(
        {
          accessToken: 'doku_access_token_abc123',
          tokenType: 'Bearer',
          expiresIn: 3600,
        },
        { status: 200 },
      );
    },
  ),

  http.post(
    'https://api-sandbox.doku.com/virtual-accounts/bi-snap-va/v1.1/transfer-va/create-va',
    async ({ request }) => {
      const auth = request.headers.get('Authorization');
      const partnerId = request.headers.get('X-PARTNER-ID');
      const externalId = request.headers.get('X-EXTERNAL-ID');
      const timestamp = request.headers.get('X-TIMESTAMP');
      const sig = request.headers.get('X-SIGNATURE');

      if (!auth?.startsWith('Bearer ') || !partnerId || !externalId || !timestamp || !sig) {
        return HttpResponse.json(
          { responseCode: '4007300', responseMessage: 'Missing mandatory headers' },
          { status: 400 },
        );
      }

      return HttpResponse.json(
        {
          responseCode: '2000300',
          responseMessage: 'Successful',
          partnerReferenceNo: 'order-doku-va-001',
          virtualAccountData: {
            partnerServiceId: CLIENT_ID,
            customerNo: '1234567890',
            virtualAccountNo: '9881234567890',
            virtualAccountName: 'Customer',
            virtualAccountEmail: 'customer@example.com',
            trxId: 'trx-doku-va-001',
            howToPayPage: 'https://pay.doku.com/va/123',
            howToPayApi: '',
          },
        },
        { status: 200 },
      );
    },
  ),

  http.post(
    'https://api-sandbox.doku.com/direct-debit/core/v1/debit/payment-host-to-host',
    async ({ request }) => {
      const auth = request.headers.get('Authorization');
      const partnerId = request.headers.get('X-PARTNER-ID');
      const externalId = request.headers.get('X-EXTERNAL-ID');
      const timestamp = request.headers.get('X-TIMESTAMP');
      const sig = request.headers.get('X-SIGNATURE');

      if (!auth?.startsWith('Bearer ') || !partnerId || !externalId || !timestamp || !sig) {
        return HttpResponse.json(
          { responseCode: '4007300', responseMessage: 'Missing mandatory headers' },
          { status: 400 },
        );
      }

      return HttpResponse.json(
        {
          responseCode: '2000300',
          responseMessage: 'Successful',
          partnerReferenceNo: 'order-doku-h2h-001',
          trxId: 'trx-doku-h2h-001',
          amount: { value: '50000.00', currency: 'IDR' },
          paymentStatus: 'PENDING',
          redirectUrl: 'https://pay.doku.com/h2h/redirect/123',
        },
        { status: 200 },
      );
    },
  ),

  http.post('https://api-sandbox.doku.com/service/v1/status', async ({ request }) => {
    const auth = request.headers.get('Authorization');
    const partnerId = request.headers.get('X-PARTNER-ID');
    const externalId = request.headers.get('X-EXTERNAL-ID');

    if (!auth?.startsWith('Bearer ') || !partnerId || !externalId) {
      return HttpResponse.json(
        { responseCode: '4007300', responseMessage: 'Missing mandatory headers' },
        { status: 400 },
      );
    }

    return HttpResponse.json(
      {
        responseCode: '2000300',
        responseMessage: 'Successful',
        partnerReferenceNo: 'order-doku-status-001',
        originalPartnerReferenceNo: 'order-doku-status-001',
        trxId: 'trx-doku-status-001',
        amount: { value: '50000.00', currency: 'IDR' },
        paymentStatus: 'SUCCESS',
      },
      { status: 200 },
    );
  }),
];

const server = setupServer(...handlers);

describe('Doku Integration', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  describe('authenticate', () => {
    it('obtains access token with X-SIGNATURE header', async () => {
      const auth = await gateway['authenticate']();
      expect(auth.accessToken).toBe('doku_access_token_abc123');
      expect(auth.tokenType).toBe('Bearer');
    });
  });

  describe('createPayment', () => {
    it('creates VA payment and sends mandatory headers', async () => {
      const res = await gateway.createPayment({
        amount: 50000,
        currency: 'IDR',
        referenceId: 'order-doku-va-001',
        paymentMethod: 'va',
      });

      expect(res.transactionId).toBe('trx-doku-va-001');
      expect(res.status).toBe('PENDING');
      expect(res.gateway).toBe('doku');
      expect(res.redirectUrl).toBe('https://pay.doku.com/va/123');
    });

    it('creates H2H payment for ewallet hint', async () => {
      const res = await gateway.createPayment({
        amount: 50000,
        currency: 'IDR',
        referenceId: 'order-doku-h2h-001',
        paymentMethod: 'ewallet',
        returnUrl: 'https://example.com/return',
      });

      expect(res.transactionId).toBe('trx-doku-h2h-001');
      expect(res.status).toBe('PENDING');
    });

    it('creates H2H payment for card hint', async () => {
      const res = await gateway.createPayment({
        amount: 100000,
        currency: 'IDR',
        referenceId: 'order-doku-card-001',
        paymentMethod: 'card',
      });

      expect(res.status).toBe('PENDING');
      expect(res.gateway).toBe('doku');
    });

    it('sends all mandatory headers on transactional endpoints', async () => {
      const testGateway = new DokuGateway();
      testGateway.initialize({
        clientId: CLIENT_ID,
        secretKey: SECRET_KEY,
        privateKey: PRIVATE_KEY,
        isProduction: false,
        debug: false,
      });

      let callIndex = 0;
      const capturedHeaders: Record<string, string>[] = [];
      const origRequest = (testGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest;
      (testGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest = async (
        _url?: string,
        opts?: { headers?: Record<string, string> },
      ) => {
        callIndex++;
        capturedHeaders.push(opts?.headers ?? {});
        // First call is authenticate() — return a valid token
        if (callIndex === 1) {
          return {
            status: 200,
            body: { accessToken: 'doku_access_token_abc123', tokenType: 'Bearer', expiresIn: 3600 },
            headers: new Headers(),
          };
        }
        // Second call is the actual payment
        return {
          status: 200,
          body: {
            responseCode: '2000300',
            responseMessage: 'Successful',
            partnerReferenceNo: 'order-capture-001',
            virtualAccountData: {
              partnerServiceId: CLIENT_ID,
              customerNo: '1234567890',
              virtualAccountNo: '9881234567890',
              virtualAccountName: 'Customer',
              trxId: 'trx-capture-001',
              howToPayPage: 'https://pay.doku.com/va/capture',
              howToPayApi: '',
            },
          },
          headers: new Headers(),
        };
      };

      await testGateway.createPayment({
        amount: 25000,
        currency: 'IDR',
        referenceId: 'order-capture-001',
        paymentMethod: 'va',
      });

      expect(capturedHeaders.length).toBeGreaterThan(1);
      const headers = capturedHeaders[1] ?? {};
      expect(headers['X-PARTNER-ID']).toBe(CLIENT_ID);
      expect(headers['X-EXTERNAL-ID']).toBeTruthy();
      expect(headers['Authorization']).toBe('Bearer doku_access_token_abc123');
      expect(headers['X-TIMESTAMP']).toBeTruthy();
      expect(headers['X-SIGNATURE']).toBeTruthy();
      expect(headers['CHANNEL-ID']).toBe('DH');

      (testGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest = origRequest;
    });

    it('throws UnipayError on API error', async () => {
      const badGateway = new DokuGateway();
      badGateway.initialize({
        clientId: CLIENT_ID,
        secretKey: SECRET_KEY,
        privateKey: PRIVATE_KEY,
        isProduction: false,
        debug: false,
      });

      const origRequest = (badGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest;
      (badGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest = async () => ({
        status: 400,
        body: { responseCode: '4007300', responseMessage: 'Partner not found' },
        headers: new Headers(),
      });

      await expect(
        badGateway.createPayment({
          amount: 50000,
          currency: 'IDR',
          referenceId: 'order-fail',
          paymentMethod: 'va',
        }),
      ).rejects.toThrow(UnipayError);

      (badGateway as unknown as { apiRequest: ApiRequestMock }).apiRequest = origRequest;
    });
  });

  describe('getPaymentStatus', () => {
    it('retrieves payment status', async () => {
      const res = await gateway.getPaymentStatus('order-doku-status-001');
      expect(res.status).toBe('SUCCESS');
      expect(res.transactionId).toBe('trx-doku-status-001');
      expect(res.referenceId).toBe('order-doku-status-001');
    });
  });

  describe('cardBinding', () => {
    it('throws NOT_IMPLEMENTED for card binding', async () => {
      await expect(
        (gateway as unknown as { cardBinding: (req: unknown) => Promise<unknown> }).cardBinding({}),
      ).rejects.toThrow(UnipayError);
    });
  });

  describe('handleWebhook', () => {
    it('verifies valid webhook signature', async () => {
      const payload = JSON.stringify({
        trxId: 'trx-webhook-001',
        partnerReferenceNo: 'order-webhook-001',
        amount: { value: '50000.00', currency: 'IDR' },
        paymentStatus: 'SUCCESS',
        transactionStatus: 'SUCCESS',
      });

      const { hmacSha512Hex } = await import('../../../src/core/signature/hmac.js');
      const expectedSig = await hmacSha512Hex(payload, SECRET_KEY);

      const result = await gateway.handleWebhook(payload, expectedSig);
      expect(result.eventType).toBe('SUCCESS');
      expect(result.transactionId).toBe('trx-webhook-001');
      expect(result.raw).toBeTruthy();
    });

    it('rejects tampered webhook signature', async () => {
      const payload = JSON.stringify({
        trxId: 'trx-webhook-002',
        partnerReferenceNo: 'order-webhook-002',
        amount: { value: '50000.00', currency: 'IDR' },
        paymentStatus: 'SUCCESS',
      });

      await expect(gateway.handleWebhook(payload, 'tampered_signature')).rejects.toThrow(
        UnipayError,
      );
    });

    it('rejects missing signature header', async () => {
      const payload = JSON.stringify({
        trxId: 'trx-webhook-003',
        partnerReferenceNo: 'order-webhook-003',
      });

      await expect(gateway.handleWebhook(payload, undefined)).rejects.toThrow(UnipayError);
    });
  });
});
