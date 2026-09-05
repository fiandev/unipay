import { describe, it, expect, beforeAll } from 'vitest';
import { MidtransGateway } from '../../src/gateways/midtrans/index.js';

const MIDTRANS_SERVER_KEY_SANDBOX = process.env.MIDTRANS_SERVER_KEY_SANDBOX;
const MIDTRANS_CLIENT_KEY_SANDBOX = process.env.MIDTRANS_CLIENT_KEY_SANDBOX;

const describeIfMidtrans =
  MIDTRANS_SERVER_KEY_SANDBOX && MIDTRANS_CLIENT_KEY_SANDBOX ? describe : describe.skip;

describeIfMidtrans('Midtrans E2E (sandbox)', () => {
  let gateway: MidtransGateway;

  beforeAll(() => {
    gateway = new MidtransGateway();
    gateway.initialize({
      serverKey: MIDTRANS_SERVER_KEY_SANDBOX as string,
      clientKey: MIDTRANS_CLIENT_KEY_SANDBOX as string,
      isProduction: false,
      debug: false,
    });
  });

  it('createPayment → getPaymentStatus round-trip (bank_transfer)', async () => {
    const createRes = await gateway.createPayment({
      amount: 100000,
      currency: 'IDR',
      referenceId: `e2e-midtrans-${Date.now()}`,
      paymentMethod: 'bank_transfer',
      bank: 'bca',
    });

    expect(createRes.transactionId).toBeTruthy();
    expect(createRes.status).toBeDefined();

    if (createRes.transactionId) {
      const statusRes = await gateway.getPaymentStatus(createRes.transactionId);
      expect(statusRes.gateway).toBe('midtrans');
      expect(statusRes.status).toBeDefined();
    }
  });
});
