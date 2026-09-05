/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import * as crypto from 'node:crypto';
import { UnipayError } from '../../core/errors.js';

export interface XenditWebhookResult {
  eventType: string;
  transactionId: string;
  raw: unknown;
}

export function verifyXenditWebhook(
  payload: string,
  callbackTokenHeader: string | null | undefined,
  expectedToken: string,
): XenditWebhookResult {
  if (!callbackTokenHeader) {
    throw new UnipayError({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      message: 'Missing x-callback-token header',
    });
  }

  const actual = Buffer.from(callbackTokenHeader);
  const expected = Buffer.from(expectedToken);

  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new UnipayError({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      message: 'Xendit webhook callback token mismatch',
    });
  }

  const parsed = JSON.parse(payload) as {
    event?: string;
    data?: { id?: string };
  };

  return {
    eventType: parsed.event ?? 'unknown',
    transactionId: parsed.data?.id ?? '',
    raw: parsed,
  };
}
