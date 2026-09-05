/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import { describe, it, expect, assert } from 'vitest';
import { createGateway, registerGateway } from '../../../src/core/registry.js';
import { UnipayError } from '../../../src/core/errors.js';
import { AbstractPaymentGateway } from '../../../src/core/base-gateway.js';
import type { PaymentRequest, PaymentResponse } from '../../../src/core/types.js';
import { UnipayClient } from '../../../src/core/unipay-client.js';

class MockStripeGateway extends AbstractPaymentGateway {
  public override initialize(_config: Record<string, unknown>): void {
    this.initialized = true;
  }
  protected override validateConfig(_config: unknown): void {}
  public async createPayment(req: PaymentRequest): Promise<PaymentResponse> {
    return {
      gateway: 'stripe',
      transactionId: 'pi_mock',
      referenceId: req.referenceId,
      status: 'SUCCESS',
      amount: req.amount,
      currency: req.currency,
    };
  }
  public async getPaymentStatus(txnId: string): Promise<PaymentResponse> {
    return {
      gateway: 'stripe',
      transactionId: txnId,
      referenceId: 'ref_mock',
      status: 'SUCCESS',
      amount: 0,
      currency: 'usd',
    };
  }
  public async refundPayment(txnId: string, amount?: number): Promise<PaymentResponse> {
    return {
      gateway: 'stripe',
      transactionId: txnId,
      referenceId: 'ref_mock',
      status: 'SUCCESS',
      amount: amount ?? 0,
      currency: 'usd',
    };
  }
}

describe('registry', () => {
  it('throws NOT_IMPLEMENTED for unregistered gateway', () => {
    expect(() => createGateway('midtrans' as never, {} as never)).toThrow(UnipayError);
  });

  it('creates a registered gateway and initializes it', () => {
    registerGateway('stripe', MockStripeGateway);
    const gateway = createGateway('stripe', { secretKey: 'sk_test', debug: false });
    expect(gateway).toBeDefined();
  });
});

describe('createGateway with concrete adapters', () => {
  it('creates StripeGateway with valid config', () => {
    const gateway = createGateway('stripe', { secretKey: 'sk_test_abc', debug: false });
    expect(gateway).toBeDefined();
  });

  it('creates XenditGateway with valid config', () => {
    const gateway = createGateway('xendit', { secretApiKey: 'xnd_abc', debug: false });
    expect(gateway).toBeDefined();
  });

  it('creates MidtransGateway with valid config', () => {
    const gateway = createGateway('midtrans', { serverKey: 'SB-Mid-server-abc', debug: false, isProduction: false });
    expect(gateway).toBeDefined();
  });

  it('creates DokuGateway with valid config', () => {
    const gateway = createGateway('doku', {
      clientId: 'client-id',
      secretKey: 'secret',
      privateKey: 'private-key',
      debug: false,
      isProduction: false,
    });
    expect(gateway).toBeDefined();
  });

  it('throws CONFIG_INVALID for missing required fields on Xendit', () => {
    try {
      createGateway('xendit', {} as never);
      assert.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(UnipayError);
      expect((err as UnipayError).code).toBe('CONFIG_INVALID');
    }
  });

  it('throws CONFIG_INVALID for missing required fields on Doku', () => {
    try {
      createGateway('doku', { clientId: 'only' } as never);
      assert.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(UnipayError);
      expect((err as UnipayError).code).toBe('CONFIG_INVALID');
    }
  });
});

describe('UnipayClient facade', () => {
  it('creates a client with multiple gateways and returns them via use()', () => {
    const client = new UnipayClient({
      gateways: {
        stripe: { secretKey: 'sk_test', debug: false },
        xendit: { secretApiKey: 'xnd_test', debug: false },
      },
    });

    const stripeGateway = client.use('stripe');
    expect(stripeGateway).toBeDefined();

    const xenditGateway = client.use('xendit');
    expect(xenditGateway).toBeDefined();
  });

  it('use() returns gateways with the expected operations', () => {
    const client = new UnipayClient({
      gateways: {
        stripe: { secretKey: 'sk_test_client', debug: false },
      },
    });
    const clientGateway = client.use('stripe');

    expect(clientGateway.createPayment).toBeDefined();
    expect(clientGateway.getPaymentStatus).toBeDefined();
    expect(clientGateway.refundPayment).toBeDefined();
  });

  it('throws NOT_IMPLEMENTED when using an unconfigured gateway', () => {
    const client = new UnipayClient({
      gateways: {
        stripe: { secretKey: 'sk_test', debug: false },
      },
    });

    expect(() => client.use('xendit')).toThrow(UnipayError);
    expect(() => client.use('xendit')).toThrow(
      expect.objectContaining({ code: 'NOT_IMPLEMENTED' }),
    );
  });
});
