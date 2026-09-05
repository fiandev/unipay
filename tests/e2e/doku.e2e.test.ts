import { describe, it, expect, beforeAll } from 'vitest';
import { DokuGateway } from '../../src/gateways/doku/index.js';

const DOKU_CLIENT_ID_SANDBOX = process.env.DOKU_CLIENT_ID_SANDBOX;
const DOKU_SECRET_KEY_SANDBOX = process.env.DOKU_SECRET_KEY_SANDBOX;
const DOKU_PRIVATE_KEY_SANDBOX = process.env.DOKU_PRIVATE_KEY_SANDBOX;

const describeIfDoku =
  DOKU_CLIENT_ID_SANDBOX && DOKU_SECRET_KEY_SANDBOX && DOKU_PRIVATE_KEY_SANDBOX
    ? describe
    : describe.skip;

describeIfDoku('Doku E2E (sandbox)', () => {
  let gateway: DokuGateway;

  beforeAll(() => {
    gateway = new DokuGateway();
    gateway.initialize({
      clientId: DOKU_CLIENT_ID_SANDBOX as string,
      secretKey: DOKU_SECRET_KEY_SANDBOX as string,
      privateKey: DOKU_PRIVATE_KEY_SANDBOX as string,
      isProduction: false,
      debug: false,
    });
  });

  it('authenticate → createPayment → getPaymentStatus round-trip (VA)', async () => {
    const auth = await gateway.authenticate();
    expect(auth.accessToken).toBeTruthy();
    expect(auth.tokenType).toBe('Bearer');

    const createRes = await gateway.createPayment({
      amount: 75000,
      currency: 'IDR',
      referenceId: `e2e-doku-${Date.now()}`,
      paymentMethod: 'va',
      customer: { name: 'E2E Test User', email: 'e2e@example.com' },
    });

    expect(createRes.transactionId).toBeTruthy();
    expect(createRes.status).toBeDefined();

    if (createRes.transactionId) {
      const statusRes = await gateway.getPaymentStatus(createRes.transactionId);
      expect(statusRes.gateway).toBe('doku');
      expect(statusRes.status).toBeDefined();
    }
  });
});
