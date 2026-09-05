export interface MidtransChargeRequest {
  payment_type: string;
  transaction_details: {
    order_id: string;
    gross_amount: number;
  };
  bank_transfer?: {
    bank: string;
    va_number?: string;
  };
  gopay?: {
    enable_callback: boolean;
    callback_url?: string;
  };
  credit_card?: {
    token_id: string;
  };
  item_details?: MidtransItem[];
  customer_details?: MidtransCustomer;
}

export interface MidtransChargeResponse {
  status_code: string;
  status_message: string;
  transaction_id: string;
  order_id: string;
  gross_amount: string;
  payment_type: string;
  transaction_time: string;
  transaction_status: string;
  fraud_status?: string;
  va_numbers?: { bank: string; va_number: string }[];
  actions?: { name: string; method: string; url: string }[];
  expiry_time?: string;
}

export interface MidtransStatusResponse {
  status_code: string;
  status_message: string;
  transaction_id: string;
  order_id: string;
  gross_amount: string;
  payment_type: string;
  transaction_time: string;
  transaction_status: string;
  fraud_status?: string;
  settlement_time?: string;
  expiry_time?: string;
}

export interface MidtransNotificationPayload {
  transaction_time: string;
  transaction_status: string;
  transaction_id: string;
  status_message: string;
  status_code: string;
  signature_key: string;
  payment_type: string;
  order_id: string;
  gross_amount: string;
  fraud_status?: string;
  currency?: string;
}

export interface MidtransItem {
  id?: string;
  price: number;
  quantity: number;
  name: string;
  category?: string;
  merchant_name?: string;
}

export interface MidtransCustomer {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  billing_address?: MidtransAddress;
  shipping_address?: MidtransAddress;
}

export interface MidtransAddress {
  first_name?: string;
  last_name?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country_code?: string;
}

export type MidtransTransactionStatus =
  'pending' | 'settlement' | 'capture' | 'deny' | 'cancel' | 'expire' | 'refund';

export type MidtransFraudStatus = 'accept' | 'deny' | 'challenge';
