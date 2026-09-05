/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import { describe, it, expect } from 'vitest';
import { createGateway, registerGateway } from '../../src/core/registry.js';
import { UnipayError } from '../../src/core/errors.js';
import { StripeGateway } from '../../src/gateways/stripe/index.js';
import { XenditGateway } from '../../src/gateways/xendit/index.js';
import { MidtransGateway } from '../../src/gateways/midtrans/index.js';
import { DokuGateway } from '../../src/gateways/doku/index.js';

registerGateway('stripe', StripeGateway);
registerGateway('xendit', XenditGateway);
registerGateway('midtrans', MidtransGateway);
registerGateway('doku', DokuGateway);

type ApiRequestMock = (
  ...args: unknown[]
) => Promise<{ status: number; body: unknown; headers: Headers }>;

interface TestCase {
  name: string;
  gatewayName: 'stripe' | 'xendit' | 'midtrans' | 'doku';
  validConfig: Record<string, unknown>;
  invalidConfig: Record<string, unknown>;
  minimalRequest: {
    amount: number;
    currency: string;
    referenceId: string;
  };
  successFixture: unknown;
  errorFixture: { status: number; body: unknown };
}

const testCases: TestCase[] = [
  {
    name: 'stripe',
    gatewayName: 'stripe',
    validConfig: { secretKey: 'sk_test_xyz' },
    invalidConfig: {},
    minimalRequest: { amount: 2000, currency: 'usd', referenceId: 'order-test-001' },
    successFixture: {
      status: 200,
      body: {
        id: 'pi_test_123',
        object: 'payment_intent',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
        metadata: { order_id: 'order-test-001' },
      },
    },
    errorFixture: {
      status: 402,
      body: {
        error: { type: 'card_error', code: 'card_declined', message: 'Your card was declined.' },
      },
    },
  },
  {
    name: 'xendit',
    gatewayName: 'xendit',
    validConfig: { secretApiKey: 'xnd_secret_xyz' },
    invalidConfig: {},
    minimalRequest: { amount: 50000, currency: 'IDR', referenceId: 'order-xnd-001' },
    successFixture: {
      status: 200,
      body: {
        id: 'pr_test_123',
        reference_id: 'order-xnd-001',
        status: 'SUCCEEDED',
        request_amount: 50000,
        currency: 'IDR',
        country: 'ID',
        type: 'PAY',
        channel_code: 'ID_DANA',
        created: '2026-07-17T12:00:00Z',
        updated: '2026-07-17T12:00:05Z',
      },
    },
    errorFixture: {
      status: 400,
      body: { error_code: 'API_VALIDATION_ERROR', message: 'Invalid request amount' },
    },
  },
  {
    name: 'midtrans',
    gatewayName: 'midtrans',
    validConfig: { serverKey: 'Midtrans-server-key-abc123' },
    invalidConfig: {},
    minimalRequest: { amount: 100000, currency: 'IDR', referenceId: 'order-mid-001' },
    successFixture: {
      status: 200,
      body: {
        status_code: '201',
        status_message: 'Success, Credit Card transaction is successful',
        transaction_id: 'trx-mid-001',
        order_id: 'order-mid-001',
        gross_amount: '100000.00',
        payment_type: 'credit_card',
        transaction_time: '2026-07-17T12:00:00Z',
        transaction_status: 'settlement',
        fraud_status: 'accept',
      },
    },
    errorFixture: {
      status: 400,
      body: { status_code: '400', status_message: 'Transaction amount exceeds limit' },
    },
  },
  {
    name: 'doku',
    gatewayName: 'doku',
    validConfig: {
      clientId: 'doku-client-id',
      secretKey: 'doku-secret-key',
      privateKey: `-----BEGIN PRIVATE KEY-----
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
-----END PRIVATE KEY-----`,
    },
    invalidConfig: {},
    minimalRequest: { amount: 50000, currency: 'IDR', referenceId: 'order-doku-001' },
    successFixture: {
      status: 200,
      body: {
        responseCode: '2000300',
        responseMessage: 'Successful',
        partnerReferenceNo: 'order-doku-001',
        virtualAccountData: {
          partnerServiceId: 'doku-client-id',
          customerNo: '1234567890',
          virtualAccountNo: '9881234567890',
          virtualAccountName: 'Customer',
          trxId: 'trx-doku-001',
          howToPayPage: 'https://pay.doku.com/va/123',
          howToPayApi: '',
        },
      },
    },
    errorFixture: {
      status: 400,
      body: { responseCode: '4007300', responseMessage: 'Partner not found' },
    },
  },
];

describe.each(testCases)('$name contract', (testCase) => {
  it('constructor throws UnipayError for invalid config', () => {
    expect(() => createGateway(testCase.gatewayName, testCase.invalidConfig as never)).toThrow(
      UnipayError,
    );
  });

  it('createPayment with minimal valid request does not throw', async () => {
    const gateway = createGateway(testCase.gatewayName, testCase.validConfig as never);
    await expect(gateway.createPayment(testCase.minimalRequest)).rejects.not.toBeUndefined();
  }, 30000);

  it('createPayment with HTTP error throws UnipayError GATEWAY_ERROR', async () => {
    const gateway = createGateway(testCase.gatewayName, testCase.validConfig as never);
    const errFixture = testCase.errorFixture;

    const cast = gateway as unknown as { apiRequest: ApiRequestMock };
    const originalRequest = cast.apiRequest;
    let callCount = 0;
    cast.apiRequest = async () => {
      callCount++;
      // Doku authenticates first (separate apiRequest call), so return success for auth then fail for payment
      // Other gateways (Stripe/Xendit/Midtrans) have static auth and go straight to payment
      if (callCount > 1 && testCase.gatewayName === 'doku') {
        return { status: errFixture.status, body: errFixture.body, headers: new Headers() };
      }
      if (testCase.gatewayName !== 'doku') {
        return { status: errFixture.status, body: errFixture.body, headers: new Headers() };
      }
      return {
        status: 200,
        body: { accessToken: 'test', tokenType: 'Bearer', expiresIn: 3600 },
        headers: new Headers(),
      };
    };

    try {
      await gateway.createPayment(testCase.minimalRequest);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(UnipayError);
      expect((err as UnipayError).code).toBe('GATEWAY_ERROR');
    }

    cast.apiRequest = originalRequest;
  });
});
