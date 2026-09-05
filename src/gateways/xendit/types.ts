/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

export interface XenditPaymentRequest {
  id: string;
  reference_id: string;
  status: XenditPaymentRequestStatus;
  amount?: number;
  request_amount?: number;
  currency: string;
  country: string;
  type: 'PAY';
  channel_code: string;
  channel_properties?: Record<string, string>;
  customer?: XenditCustomer;
  items?: XenditItem[];
  actions?: XenditAction[];
  failure_code?: string;
  failure_message?: string;
  created: string;
  updated: string;
  metadata?: Record<string, unknown>;
}

export type XenditPaymentRequestStatus =
  | 'PENDING'
  | 'REQUIRES_ACTION'
  | 'ACCEPTING_PAYMENTS'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELED'
  | 'EXPIRED'
  | 'AUTHORIZED';

export interface XenditCustomer {
  reference_id?: string;
  type?: 'INDIVIDUAL' | 'BUSINESS';
  given_names?: string;
  surname?: string;
  email?: string;
  mobile_number?: string;
  phone_number?: string;
  address?: XenditAddress;
}

export interface XenditAddress {
  country: string;
  street_line_1?: string;
  street_line_2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
}

export interface XenditItem {
  reference_id?: string;
  name: string;
  category?: string;
  price: number;
  quantity: number;
  description?: string;
  type?: string;
  url?: string;
}

export interface XenditAction {
  type: string;
  value: string;
}

export interface XenditWebhookPayload {
  event: string;
  business_id?: string;
  data: XenditPaymentRequest;
  created: string;
}
