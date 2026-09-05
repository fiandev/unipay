import type {
  PaymentRequest,
  PaymentResponseStatus,
  CustomerInfo,
  LineItem,
} from '../../core/types.js';
import type {
  XenditPaymentRequest,
  XenditPaymentRequestStatus,
  XenditCustomer,
  XenditItem,
} from './types.js';

const HINT_TO_CHANNEL_CODE: Record<string, string | undefined> = {
  card: 'CARDS',
  ewallet: 'ID_DANA',
  bank_transfer: 'ID_BCA',
  qris: 'ID_QRIS',
  va: 'ID_BCA',
};

export function resolveChannelCode(request: PaymentRequest): string {
  if (request.metadata?.channelCode) {
    return String(request.metadata.channelCode);
  }
  if (request.paymentMethod) {
    const code = HINT_TO_CHANNEL_CODE[request.paymentMethod];
    if (code) return code;
  }
  return 'ID_DANA';
}

export function toVendorPayload(
  request: PaymentRequest,
  channelCode: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    reference_id: request.referenceId,
    type: 'PAY',
    currency: request.currency,
    request_amount: request.amount,
    country: request.country ?? 'ID',
    channel_code: channelCode,
  };

  if (request.description) {
    payload.description = request.description;
  }

  if (request.customer) {
    payload.customer = mapCustomer(request.customer);
  }

  if (request.items && request.items.length > 0) {
    payload.items = request.items.map(mapItem);
  }

  if (request.metadata) {
    payload.metadata = request.metadata;
  }

  if (request.returnUrl || request.cancelUrl) {
    payload.channel_properties = {
      ...(request.returnUrl ? { success_return_url: request.returnUrl } : {}),
      ...(request.cancelUrl ? { failure_return_url: request.cancelUrl } : {}),
    };
  }

  return payload;
}

function mapCustomer(customer: CustomerInfo): XenditCustomer {
  const xenditCustomer: XenditCustomer = {};
  if (customer.name) {
    const parts = customer.name.split(' ');
    xenditCustomer.given_names = parts[0] ?? customer.name;
    if (parts.length > 1) {
      xenditCustomer.surname = parts.slice(1).join(' ');
    }
  }
  if (customer.email) {
    xenditCustomer.email = customer.email;
  }
  if (customer.phone) {
    xenditCustomer.mobile_number = customer.phone;
  }
  if (customer.address) {
    xenditCustomer.address = {
      country: customer.address.country ?? 'ID',
      city: customer.address.city,
      postal_code: customer.address.postalCode,
      street_line_1: customer.address.street,
    };
  }
  return xenditCustomer;
}

function mapItem(item: LineItem): XenditItem {
  return {
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    category: item.category,
    description: item.description,
    reference_id: item.id,
  };
}

const XENDIT_TO_UNIVERSAL_STATUS: Record<XenditPaymentRequestStatus, PaymentResponseStatus> = {
  PENDING: 'PENDING',
  REQUIRES_ACTION: 'PENDING',
  ACCEPTING_PAYMENTS: 'PENDING',
  SUCCEEDED: 'SUCCESS',
  FAILED: 'FAILED',
  CANCELED: 'CANCELED',
  EXPIRED: 'EXPIRED',
  AUTHORIZED: 'PENDING',
};

export function fromVendorResponse(paymentRequest: XenditPaymentRequest): {
  transactionId: string;
  status: PaymentResponseStatus;
  gatewayCode?: string;
  gatewayMessage?: string;
  redirectUrl?: string;
} {
  const status = XENDIT_TO_UNIVERSAL_STATUS[paymentRequest.status] ?? 'PENDING';
  const result: {
    transactionId: string;
    status: PaymentResponseStatus;
    gatewayCode?: string;
    gatewayMessage?: string;
    redirectUrl?: string;
  } = {
    transactionId: paymentRequest.id,
    status,
  };

  if (paymentRequest.failure_code) {
    result.gatewayCode = paymentRequest.failure_code;
  }
  if (paymentRequest.failure_message) {
    result.gatewayMessage = paymentRequest.failure_message;
  }

  const redirectAction = paymentRequest.actions?.find((a) => a.type === 'REDIRECT_CUSTOMER');
  if (redirectAction?.value) {
    result.redirectUrl = redirectAction.value;
  }

  return result;
}
