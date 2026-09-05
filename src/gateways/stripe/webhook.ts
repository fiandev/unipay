import { UnipayError } from '../../core/errors.js';
import { hmacSha256Hex } from '../../core/signature/index.js';

export interface StripeWebhookResult {
  eventType: string;
  transactionId: string;
  raw: unknown;
}

export async function verifyStripeWebhook(
  payload: string,
  signatureHeader: string,
  webhookSecret: string,
): Promise<StripeWebhookResult> {
  const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split('=');
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  }, {});

  const timestamp = parts['t'];
  const signature = parts['v1'];

  if (!timestamp || !signature) {
    throw new UnipayError({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      message: 'Missing timestamp or signature in Stripe-Signature header',
    });
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = await hmacSha256Hex(signedPayload, webhookSecret);

  if (expectedSignature !== signature) {
    throw new UnipayError({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      message: 'Stripe webhook signature mismatch',
    });
  }

  const parsed = JSON.parse(payload) as {
    type?: string;
    data?: { object?: { id?: string } };
  };

  return {
    eventType: parsed.type ?? 'unknown',
    transactionId: parsed.data?.object?.id ?? '',
    raw: parsed,
  };
}
