import { describe, it, expect, beforeAll } from 'vitest';
import { XenditGateway } from '../../src/gateways/xendit/index.js';

const XENDIT_TEST_KEY = process.env.XENDIT_TEST_KEY;

const describeIfXendit = XENDIT_TEST_KEY ? describe : describe.skip;

describeIfXendit('Xendit E2E (sandbox)', () => {
  let gateway: XenditGateway;

  beforeAll(() => {
    gateway = new XenditGateway();
    gateway.initialize({
      secretApiKey: XENDIT_TEST_KEY as string,
      debug: false,
    });
  });

  it('createPayment → getPaymentStatus round-trip', async () => {
    const createRes = await gateway.createPayment({
      amount: 50000,
      currency: 'IDR',
      referenceId: `e2e-xendit-${Date.now()}`,
      paymentMethod: 'ewallet',
      country: 'ID',
    });

    expect(createRes.transactionId).toBeTruthy();
    expect(createRes.status).toBeDefined();

    if (createRes.transactionId) {
      const statusRes = await gateway.getPaymentStatus(createRes.transactionId);
      expect(statusRes.gateway).toBe('xendit');
      expect(statusRes.status).toBeDefined();
    }
  });
});
