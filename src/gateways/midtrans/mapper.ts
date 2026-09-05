/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import type {
  PaymentRequest,
  PaymentResponseStatus,
  CustomerInfo,
  LineItem,
} from '../../core/types.js';
import type {
  MidtransChargeRequest,
  MidtransChargeResponse,
  MidtransStatusResponse,
  MidtransItem,
  MidtransCustomer,
  MidtransAddress,
  MidtransTransactionStatus,
  MidtransFraudStatus,
} from './types.js';

export function toVendorPayload(
  request: PaymentRequest,
  paymentType: string,
): MidtransChargeRequest {
  const payload: MidtransChargeRequest = {
    payment_type: paymentType,
    transaction_details: {
      order_id: request.referenceId,
      gross_amount: request.amount,
    },
  };

  if (paymentType === 'bank_transfer') {
    payload.bank_transfer = {
      bank: request.bank ?? 'bca',
    };
    if (request.metadata?.vaNumber) {
      payload.bank_transfer.va_number = String(request.metadata.vaNumber);
    }
  } else if (paymentType === 'gopay') {
    payload.gopay = {
      enable_callback: true,
      callback_url: request.callbackUrl,
    };
  } else if (paymentType === 'credit_card') {
    if (!request.tokenId) {
      throw new Error('tokenId is required for credit_card payment_type');
    }
    payload.credit_card = {
      token_id: request.tokenId,
    };
  }

  if (request.items && request.items.length > 0) {
    payload.item_details = request.items.map(mapItem);
  }

  if (request.customer) {
    payload.customer_details = mapCustomer(request.customer);
  }

  return payload;
}

export function resolvePaymentType(hint: string | undefined): string {
  switch (hint) {
    case 'bank_transfer':
    case 'va':
      return 'bank_transfer';
    case 'ewallet':
      return 'gopay';
    case 'card':
      return 'credit_card';
    default:
      return 'bank_transfer';
  }
}

function mapItem(item: LineItem): MidtransItem {
  return {
    id: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    category: item.category,
  };
}

function mapCustomer(customer: CustomerInfo): MidtransCustomer {
  const midtransCustomer: MidtransCustomer = {};
  if (customer.name) {
    const parts = customer.name.split(' ');
    midtransCustomer.first_name = parts[0];
    if (parts.length > 1) {
      midtransCustomer.last_name = parts.slice(1).join(' ');
    }
  }
  if (customer.email) {
    midtransCustomer.email = customer.email;
  }
  if (customer.phone) {
    midtransCustomer.phone = customer.phone;
  }
  if (customer.address) {
    const addr: MidtransAddress = {
      address: customer.address.street,
      city: customer.address.city,
      postal_code: customer.address.postalCode,
      country_code: customer.address.country,
    };
    midtransCustomer.billing_address = addr;
    midtransCustomer.shipping_address = addr;
  }
  return midtransCustomer;
}

export function fromChargeResponse(
  res: MidtransChargeResponse | MidtransStatusResponse,
  _referenceId: string,
): {
  transactionId: string;
  status: PaymentResponseStatus;
  gatewayCode?: string;
  gatewayMessage?: string;
  redirectUrl?: string;
} {
  const transactionStatus = res.transaction_status as MidtransTransactionStatus;
  const fraudStatus = res.fraud_status as MidtransFraudStatus | undefined;
  const status = mapStatus(transactionStatus, fraudStatus);

  const result: {
    transactionId: string;
    status: PaymentResponseStatus;
    gatewayCode?: string;
    gatewayMessage?: string;
    redirectUrl?: string;
  } = {
    transactionId: res.transaction_id,
    status,
  };

  result.gatewayCode = res.status_code;
  result.gatewayMessage = res.status_message;

  if ('actions' in res && res.actions && res.actions.length > 0) {
    const redirectAction = res.actions.find((a) => a.name === 'redirect' || a.method === 'GET');
    if (redirectAction?.url) {
      result.redirectUrl = redirectAction.url;
    }
  }

  return result;
}

export function fromStatusResponse(
  res: MidtransStatusResponse,
  _referenceId: string,
): {
  transactionId: string;
  status: PaymentResponseStatus;
  gatewayCode?: string;
  gatewayMessage?: string;
  redirectUrl?: string;
} {
  const transactionStatus = res.transaction_status as MidtransTransactionStatus;
  const fraudStatus = res.fraud_status as MidtransFraudStatus | undefined;
  const status = mapStatus(transactionStatus, fraudStatus);

  return {
    transactionId: res.transaction_id,
    status,
    gatewayCode: res.status_code,
    gatewayMessage: res.status_message,
  };
}

function mapStatus(
  transactionStatus: MidtransTransactionStatus,
  fraudStatus?: MidtransFraudStatus,
): PaymentResponseStatus {
  switch (transactionStatus) {
    case 'pending':
      return 'PENDING';
    case 'settlement':
    case 'capture':
      if (fraudStatus === 'accept' || !fraudStatus) {
        return 'SUCCESS';
      }
      if (fraudStatus === 'deny' || fraudStatus === 'challenge') {
        return 'FAILED';
      }
      return 'PENDING';
    case 'deny':
      return 'FAILED';
    case 'cancel':
      return 'CANCELED';
    case 'expire':
      return 'EXPIRED';
    case 'refund':
      return 'FAILED';
    default:
      return 'PENDING';
  }
}
