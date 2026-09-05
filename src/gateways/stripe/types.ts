/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

export interface StripePaymentIntent {
  id: string;
  object: 'payment_intent';
  amount: number;
  currency: string;
  status: StripePaymentIntentStatus;
  metadata: Record<string, string>;
  client_secret?: string;
  receipt_email?: string;
  description?: string;
  next_action?: StripeNextAction;
  cancellation_reason?: string;
  last_payment_error?: StripePaymentError;
}

export type StripePaymentIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'canceled';

export interface StripeNextAction {
  type: string;
  redirect_to_url?: {
    url: string;
    return_url?: string;
  };
}

export interface StripePaymentError {
  type: string;
  code?: string;
  decline_code?: string;
  message: string;
}

export interface StripeWebhookPayload {
  id: string;
  type: string;
  data: {
    object: StripePaymentIntent;
  };
  created: number;
  livemode: boolean;
  pending_webhooks: number;
  request?: {
    id: string;
    idempotency_key: string | null;
  };
}

export interface StripeWebhookHeaders {
  timestamp: string;
  signatures: string[];
}
