/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import type { PaymentRequest, PaymentResponseStatus } from '../../core/types.js';
import type { StripePaymentIntent, StripePaymentIntentStatus } from './types.js';

export function toVendorPayload(request: PaymentRequest): Record<string, string> {
  const params: Record<string, string> = {};

  params.amount = String(request.amount);
  params.currency = request.currency.toLowerCase();

  if (request.description) {
    params.description = request.description;
  }

  if (request.paymentMethod === 'card') {
    params['payment_method_types[]'] = 'card';
  } else if (!request.paymentMethod) {
    params['automatic_payment_methods[enabled]'] = 'true';
  }

  if (request.referenceId) {
    params['metadata[order_id]'] = request.referenceId;
  }

  if (request.customer?.email) {
    params.receipt_email = request.customer.email;
  }

  if (request.customer?.name) {
    params['metadata[customer_name]'] = request.customer.name;
  }

  if (request.returnUrl) {
    params['return_url'] = request.returnUrl;
  }

  return params;
}

const STRIPE_TO_UNIVERSAL_STATUS: Record<StripePaymentIntentStatus, PaymentResponseStatus> = {
  requires_payment_method: 'PENDING',
  requires_confirmation: 'PENDING',
  requires_action: 'PENDING',
  processing: 'PENDING',
  succeeded: 'SUCCESS',
  canceled: 'CANCELED',
};

export function fromVendorResponse(
  intent: StripePaymentIntent,
  _gatewayName: 'stripe',
): {
  transactionId: string;
  status: PaymentResponseStatus;
  gatewayCode?: string;
  gatewayMessage?: string;
  redirectUrl?: string;
} {
  const status = STRIPE_TO_UNIVERSAL_STATUS[intent.status] ?? 'PENDING';
  const result: {
    transactionId: string;
    status: PaymentResponseStatus;
    gatewayCode?: string;
    gatewayMessage?: string;
    redirectUrl?: string;
  } = {
    transactionId: intent.id,
    status,
  };

  if (intent.last_payment_error) {
    result.gatewayCode = intent.last_payment_error.code;
    result.gatewayMessage = intent.last_payment_error.message;
  }

  if (intent.status === 'requires_action' && intent.next_action?.redirect_to_url?.url) {
    result.redirectUrl = intent.next_action.redirect_to_url.url;
  }

  return result;
}
