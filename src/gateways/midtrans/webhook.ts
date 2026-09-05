/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import * as crypto from 'node:crypto';
import { UnipayError } from '../../core/errors.js';
import { sha512Hex } from '../../core/signature/sha.js';
import type { MidtransNotificationPayload } from './types.js';

export interface MidtransWebhookResult {
  eventType: string;
  transactionId: string;
  raw: unknown;
}

/**
 * Verify Midtrans Core API v2 webhook notification.
 *
 * Re-computes signature_key = SHA512(order_id + status_code + gross_amount + server_key)
 * and compares it with the signature_key in the notification payload using timingSafeEqual.
 *
 * NOTE: This is based on the common Midtrans Core API v2 pattern.
 * Re-validate against the real sandbox dashboard/documentation before production.
 */
export async function verifyMidtransWebhook(
  payload: string,
  serverKey: string,
): Promise<MidtransWebhookResult> {
  let parsed: MidtransNotificationPayload;
  try {
    parsed = JSON.parse(payload) as MidtransNotificationPayload;
  } catch {
    throw new UnipayError({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      message: 'Invalid JSON payload in Midtrans webhook notification',
    });
  }

  const { order_id, status_code, gross_amount, signature_key } = parsed;

  if (!order_id || !status_code || !gross_amount || !signature_key) {
    throw new UnipayError({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      message: 'Missing required fields in Midtrans webhook notification',
    });
  }

  const rawString = `${order_id}${status_code}${gross_amount}${serverKey}`;
  const computedSignature = await sha512Hex(rawString);

  const actual = Buffer.from(computedSignature);
  const expected = Buffer.from(signature_key);

  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new UnipayError({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      message: 'Midtrans webhook signature mismatch',
    });
  }

  const transactionStatus = parsed.transaction_status ?? 'unknown';

  return {
    eventType: transactionStatus,
    transactionId: parsed.transaction_id ?? parsed.order_id,
    raw: parsed,
  };
}
