import type { GatewayName, WebhookEvent } from '../core/types.js';
import { UnipayError } from '../core/errors.js';
import { verifyStripeWebhook } from '../gateways/stripe/webhook.js';
import { verifyXenditWebhook } from '../gateways/xendit/webhook.js';
import { verifyMidtransWebhook } from '../gateways/midtrans/webhook.js';
import { verifyDokuWebhook } from '../gateways/doku/webhook.js';

export interface VerifyWebhookOptions {
  throwOnInvalid?: boolean;
}

const KNOWN_GATEWAYS: readonly GatewayName[] = ['stripe', 'xendit', 'midtrans', 'doku'];

export async function verifyWebhook(
  gateway: GatewayName,
  payload: string | Buffer,
  headers: Record<string, string>,
  secret: string,
  options?: VerifyWebhookOptions,
): Promise<WebhookEvent> {
  const throwOnInvalid = options?.throwOnInvalid ?? true;
  const payloadStr = typeof payload === 'string' ? payload : payload.toString('utf-8');

  if (!KNOWN_GATEWAYS.includes(gateway)) {
    throw new UnipayError({
      code: 'VALIDATION_ERROR',
      message: `Unknown gateway: "${gateway}"`,
    });
  }

  try {
    let result: { eventType: string; transactionId: string; raw: unknown };

    switch (gateway) {
      case 'stripe':
        result = await verifyStripeWebhook(payloadStr, headers['stripe-signature'] ?? '', secret);
        break;
      case 'xendit':
        result = verifyXenditWebhook(payloadStr, headers['x-callback-token'], secret);
        break;
      case 'midtrans':
        result = await verifyMidtransWebhook(payloadStr, secret);
        break;
      case 'doku':
        result = await verifyDokuWebhook(payloadStr, headers['x-signature'], secret);
        break;
    }

    return {
      gateway,
      eventType: result.eventType,
      transactionId: result.transactionId,
      raw: result.raw,
      verified: true,
    };
  } catch (err) {
    if (err instanceof UnipayError && err.code === 'WEBHOOK_SIGNATURE_INVALID') {
      if (throwOnInvalid) {
        throw err;
      }
      return {
        gateway,
        eventType: 'unknown',
        raw: null,
        verified: false,
      };
    }
    throw err;
  }
}
