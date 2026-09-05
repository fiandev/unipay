/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import { describe, it, expectTypeOf, assertType } from 'vitest';
import type {
  GatewayName,
  PaymentResponseStatus,
  IPaymentGateway,
  WebhookEvent,
} from '../../src/core/types.js';
import type { UnipayErrorCode } from '../../src/core/errors.js';
import { createGateway } from '../../src/core/registry.js';
import type { GatewayConfig } from '../../src/core/config.js';

describe('type-level tests', () => {
  it('createGateway narrows config type per gateway', () => {
    const stripeGateway = createGateway('stripe', { secretKey: 'sk_test', debug: false });
    expectTypeOf(stripeGateway).toMatchTypeOf<IPaymentGateway>();

    const xenditGateway = createGateway('xendit', { secretApiKey: 'xnd_test', debug: false });
    expectTypeOf(xenditGateway).toMatchTypeOf<IPaymentGateway>();

    const midtransGateway = createGateway('midtrans', { serverKey: 'SB-Mid-server-test', debug: false, isProduction: false });
    expectTypeOf(midtransGateway).toMatchTypeOf<IPaymentGateway>();

    const dokuGateway = createGateway('doku', {
      clientId: 'test',
      secretKey: 'test',
      privateKey: 'test',
      isProduction: false,
      debug: false,
    });
    expectTypeOf(dokuGateway).toMatchTypeOf<IPaymentGateway>();
  });

  it('PaymentResponse.status only accepts valid union members', () => {
    const valid: PaymentResponseStatus = 'SUCCESS';
    assertType<'SUCCESS'>(valid);

    const statuses: PaymentResponseStatus[] = [
      'SUCCESS',
      'PENDING',
      'FAILED',
      'CANCELED',
      'EXPIRED',
      'REFUNDED',
      'REQUIRES_ACTION',
    ];
    expectTypeOf(statuses).items.toMatchTypeOf<PaymentResponseStatus>();

    expectTypeOf<PaymentResponseStatus>()
      .exclude<
        'SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELED' | 'EXPIRED' | 'REFUNDED' | 'REQUIRES_ACTION'
      >()
      .toEqualTypeOf<never>();
  });

  it('GatewayName only accepts valid gateway names', () => {
    const valid: GatewayName = 'stripe';
    assertType<'stripe'>(valid);

    const names: GatewayName[] = ['stripe', 'xendit', 'midtrans', 'doku'];
    expectTypeOf(names).items.toMatchTypeOf<GatewayName>();

    expectTypeOf<GatewayName>()
      .exclude<'stripe' | 'xendit' | 'midtrans' | 'doku'>()
      .toEqualTypeOf<never>();
  });

  it('UnipayErrorCode includes WEBHOOK_SIGNATURE_INVALID', () => {
    const code: UnipayErrorCode = 'WEBHOOK_SIGNATURE_INVALID';
    assertType<'WEBHOOK_SIGNATURE_INVALID'>(code);
  });

  it('WebhookEvent has verified field', () => {
    const event: WebhookEvent = {
      gateway: 'stripe',
      eventType: 'payment.success',
      raw: {},
      verified: true,
    };
    expectTypeOf(event.verified).toBeBoolean();
  });

  it('GatewayConfig has stripe config with secretKey', () => {
    expectTypeOf<GatewayConfig['stripe']>().toHaveProperty('secretKey');
    expectTypeOf<GatewayConfig['xendit']>().toHaveProperty('secretApiKey');
    expectTypeOf<GatewayConfig['midtrans']>().toHaveProperty('serverKey');
    expectTypeOf<GatewayConfig['doku']>().toHaveProperty('clientId');
    expectTypeOf<GatewayConfig['doku']>().toHaveProperty('secretKey');
    expectTypeOf<GatewayConfig['doku']>().toHaveProperty('privateKey');
  });
});
