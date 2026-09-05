import { describe, it, expect } from 'vitest';
import { verifyMidtransWebhook } from '../../../src/gateways/midtrans/webhook.js';
import { UnipayError } from '../../../src/core/errors.js';
import { sha512Hex } from '../../../src/core/signature/sha.js';

const SERVER_KEY = 'Midtrans-server-key-test123';

describe('Midtrans Webhook', () => {
  it('verifies valid signature', async () => {
    const order_id = 'ORDER-001';
    const status_code = '200';
    const gross_amount = '100000.00';
    const rawString = `${order_id}${status_code}${gross_amount}${SERVER_KEY}`;
    const signature_key = await sha512Hex(rawString);

    const payload = JSON.stringify({
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status: 'settlement',
      transaction_id: 'TRX-001',
    });

    const result = await verifyMidtransWebhook(payload, SERVER_KEY);
    expect(result.eventType).toBe('settlement');
    expect(result.transactionId).toBe('TRX-001');
  });

  it('throws on invalid JSON', async () => {
    await expect(verifyMidtransWebhook('not-json', SERVER_KEY)).rejects.toThrow(UnipayError);
    await expect(verifyMidtransWebhook('not-json', SERVER_KEY)).rejects.toMatchObject({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      message: 'Invalid JSON payload in Midtrans webhook notification',
    });
  });

  it('throws when order_id is missing', async () => {
    const payload = JSON.stringify({
      status_code: '200',
      gross_amount: '10000',
      signature_key: 'sig',
    });

    await expect(verifyMidtransWebhook(payload, SERVER_KEY)).rejects.toThrow(UnipayError);
    await expect(verifyMidtransWebhook(payload, SERVER_KEY)).rejects.toMatchObject({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      message: 'Missing required fields in Midtrans webhook notification',
    });
  });

  it('throws when status_code is missing', async () => {
    const payload = JSON.stringify({
      order_id: 'ORDER-001',
      gross_amount: '10000',
      signature_key: 'sig',
    });

    await expect(verifyMidtransWebhook(payload, SERVER_KEY)).rejects.toThrow(UnipayError);
  });

  it('throws when gross_amount is missing', async () => {
    const payload = JSON.stringify({
      order_id: 'ORDER-001',
      status_code: '200',
      signature_key: 'sig',
    });

    await expect(verifyMidtransWebhook(payload, SERVER_KEY)).rejects.toThrow(UnipayError);
  });

  it('throws when signature_key is missing', async () => {
    const payload = JSON.stringify({
      order_id: 'ORDER-001',
      status_code: '200',
      gross_amount: '10000',
    });

    await expect(verifyMidtransWebhook(payload, SERVER_KEY)).rejects.toThrow(UnipayError);
  });

  it('throws when signature does not match', async () => {
    const payload = JSON.stringify({
      order_id: 'ORDER-001',
      status_code: '200',
      gross_amount: '10000',
      signature_key: 'tampered_signature',
      transaction_status: 'settlement',
      transaction_id: 'TRX-001',
    });

    await expect(verifyMidtransWebhook(payload, SERVER_KEY)).rejects.toThrow(UnipayError);
    await expect(verifyMidtransWebhook(payload, SERVER_KEY)).rejects.toMatchObject({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      message: 'Midtrans webhook signature mismatch',
    });
  });

  it('uses order_id as transactionId when transaction_id is missing', async () => {
    const order_id = 'ORDER-002';
    const status_code = '200';
    const gross_amount = '50000.00';
    const rawString = `${order_id}${status_code}${gross_amount}${SERVER_KEY}`;
    const signature_key = await sha512Hex(rawString);

    const payload = JSON.stringify({
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status: 'pending',
    });

    const result = await verifyMidtransWebhook(payload, SERVER_KEY);
    expect(result.transactionId).toBe(order_id);
  });

  it('defaults transaction_status to unknown when missing', async () => {
    const order_id = 'ORDER-003';
    const status_code = '200';
    const gross_amount = '25000.00';
    const rawString = `${order_id}${status_code}${gross_amount}${SERVER_KEY}`;
    const signature_key = await sha512Hex(rawString);

    const payload = JSON.stringify({
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_id: 'TRX-003',
    });

    const result = await verifyMidtransWebhook(payload, SERVER_KEY);
    expect(result.eventType).toBe('unknown');
  });
});
