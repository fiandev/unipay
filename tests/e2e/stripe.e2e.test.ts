import { describe, it, expect, beforeAll } from 'vitest';
import { StripeGateway } from '../../src/gateways/stripe/index.js';

const STRIPE_TEST_KEY = process.env.STRIPE_TEST_KEY;

const describeIfStripe = STRIPE_TEST_KEY ? describe : describe.skip;

describeIfStripe('Stripe E2E (sandbox)', () => {
  let gateway: StripeGateway;

  beforeAll(() => {
    gateway = new StripeGateway();
    gateway.initialize({
      secretKey: STRIPE_TEST_KEY as string,
      debug: false,
    });
  });

  it('createPayment → getPaymentStatus round-trip', async () => {
    const createRes = await gateway.createPayment({
      amount: 100,
      currency: 'usd',
      referenceId: `e2e-stripe-${Date.now()}`,
      description: 'E2E test payment',
      paymentMethod: 'card',
    });

    expect(createRes.transactionId).toBeTruthy();
    expect(createRes.status).toBeDefined();

    if (createRes.transactionId) {
      const statusRes = await gateway.getPaymentStatus(createRes.transactionId);
      expect(statusRes.gateway).toBe('stripe');
      expect(statusRes.status).toBeDefined();
    }
  });
});
