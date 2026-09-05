export type GatewayName = 'stripe' | 'xendit' | 'midtrans' | 'doku';

export type PaymentStatus =
  'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELED' | 'EXPIRED' | 'REFUNDED' | 'REQUIRES_ACTION';

export type PaymentMethodHint = 'card' | 'ewallet' | 'bank_transfer' | 'qris' | 'va';

export interface CustomerInfo {
  name?: string;
  email?: string;
  phone?: string;
  address?: AddressInfo;
}

export interface AddressInfo {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface LineItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  category?: string;
  description?: string;
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  referenceId: string;
  description?: string;
  customer?: CustomerInfo;
  items?: LineItem[];
  paymentMethod?: PaymentMethodHint;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  returnUrl?: string;
  cancelUrl?: string;
  webhookUrl?: string;
  country?: string;
  callbackUrl?: string;
  bank?: string;
  tokenId?: string;
}

export type PaymentResponseStatus =
  'SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELED' | 'EXPIRED' | 'REFUNDED' | 'REQUIRES_ACTION';

export interface PaymentResponse {
  gateway: GatewayName;
  transactionId: string;
  referenceId: string;
  status: PaymentResponseStatus;
  amount: number;
  currency: string;
  gatewayCode?: string;
  gatewayMessage?: string;
  redirectUrl?: string;
  rawResponse?: unknown;
}

export interface AuthTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresAt: Date | null;
  rawResponse?: unknown;
}

export interface WebhookEvent<T = unknown> {
  gateway: GatewayName;
  eventType: string;
  transactionId?: string;
  status?: PaymentStatus;
  raw: T;
  verified: boolean;
}

export interface IPaymentGateway {
  createPayment(request: PaymentRequest): Promise<PaymentResponse>;
  getPaymentStatus(transactionId: string): Promise<PaymentResponse>;
  refundPayment(transactionId: string, amount?: number): Promise<PaymentResponse>;
}

export interface Logger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}
