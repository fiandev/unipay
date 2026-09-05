import { UnipayError } from '../../core/errors.js';
import { hmacSha512Hex } from '../../core/signature/hmac.js';

export interface DokuWebhookResult {
  eventType: string;
  transactionId: string;
  raw: unknown;
}

/**
 * Verify Doku webhook notification signature.
 *
 * Doku uses HMAC-SHA512 for webhook payload signing (same scheme as request signing).
 * The exact payload components used for signing should be verified during real sandbox integration.
 * This implementation assumes the raw request body is the signed payload.
 */
export async function verifyDokuWebhook(
  payload: string,
  signatureHeader: string | null | undefined,
  secretKey: string,
): Promise<DokuWebhookResult> {
  if (!signatureHeader) {
    throw new UnipayError({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      message: 'Missing X-SIGNATURE header in Doku webhook notification',
    });
  }

  const computedSignature = await hmacSha512Hex(payload, secretKey);

  if (computedSignature !== signatureHeader) {
    throw new UnipayError({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      message: 'Doku webhook signature mismatch',
    });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    throw new UnipayError({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      message: 'Invalid JSON payload in Doku webhook notification',
    });
  }

  const transactionId = (parsed.trxId as string) ?? (parsed.partnerReferenceNo as string) ?? '';
  const eventType =
    (parsed.transactionStatus as string) ?? (parsed.paymentStatus as string) ?? 'unknown';

  return {
    eventType,
    transactionId,
    raw: parsed,
  };
}
