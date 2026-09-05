import type { PaymentRequest, PaymentResponseStatus } from '../../core/types.js';
import type {
  DokuCreateVaRequest,
  DokuH2hRequest,
  DokuCreateVaResponse,
  DokuH2hResponse,
  DokuStatusRequest,
  DokuStatusResponse,
} from './types.js';

export function resolveEndpoint(hint: string | undefined): string {
  switch (hint) {
    case 'va':
    case 'bank_transfer':
      return '/virtual-accounts/bi-snap-va/v1.1/transfer-va/create-va';
    case 'ewallet':
    case 'card':
      return '/direct-debit/core/v1/debit/payment-host-to-host';
    default:
      return '/virtual-accounts/bi-snap-va/v1.1/transfer-va/create-va';
  }
}

export function toCreateVaPayload(request: PaymentRequest): DokuCreateVaRequest {
  // ASUMSI STRUKTUR — verifikasi ke dokumentasi resmi Doku SNAP sebelum production
  return {
    partnerReferenceNo: request.referenceId,
    amount: {
      value: String(request.amount),
      currency: request.currency ?? 'IDR',
    },
    virtualAccountName: request.customer?.name ?? 'Customer',
    virtualAccountEmail: request.customer?.email,
    virtualAccountPhone: request.customer?.phone,
  };
}

export function toH2hPayload(request: PaymentRequest): DokuH2hRequest {
  // ASUMSI STRUKTUR — verifikasi ke dokumentasi resmi Doku SNAP sebelum production
  const payload: DokuH2hRequest = {
    partnerReferenceNo: request.referenceId,
    amount: {
      value: String(request.amount),
      currency: request.currency ?? 'IDR',
    },
  };

  if (request.paymentMethod === 'ewallet') {
    payload.paymentMethod = {
      type: 'EWALLET',
      code: 'OY',
    };
  } else if (request.paymentMethod === 'card') {
    payload.paymentMethod = {
      type: 'CARD',
    };
  }

  if (request.customer) {
    payload.customer = {
      name: request.customer.name,
      email: request.customer.email,
      phone: request.customer.phone,
      country: request.customer.address?.country,
    };
  }

  if (request.returnUrl) {
    payload.urlParam = {
      returnUrl: request.returnUrl,
    };
  }

  return payload;
}

export function toStatusPayload(referenceId: string): DokuStatusRequest {
  return {
    partnerReferenceNo: referenceId,
  };
}

export function fromCreateVaResponse(
  res: DokuCreateVaResponse,
  _referenceId: string,
): {
  transactionId: string;
  status: PaymentResponseStatus;
  gatewayCode?: string;
  gatewayMessage?: string;
  redirectUrl?: string;
} {
  return {
    transactionId: res.virtualAccountData?.trxId ?? res.partnerReferenceNo,
    status: 'PENDING',
    gatewayCode: res.responseCode,
    gatewayMessage: res.responseMessage,
    redirectUrl: res.virtualAccountData?.howToPayPage,
  };
}

export function fromH2hResponse(
  res: DokuH2hResponse,
  _referenceId: string,
): {
  transactionId: string;
  status: PaymentResponseStatus;
  gatewayCode?: string;
  gatewayMessage?: string;
  redirectUrl?: string;
} {
  return {
    transactionId: res.trxId ?? res.partnerReferenceNo,
    status: mapDokuPaymentStatus(res.paymentStatus),
    gatewayCode: res.responseCode,
    gatewayMessage: res.responseMessage,
    redirectUrl: res.redirectUrl,
  };
}

export function fromStatusResponse(
  res: DokuStatusResponse,
  _referenceId: string,
): {
  transactionId: string;
  status: PaymentResponseStatus;
  gatewayCode?: string;
  gatewayMessage?: string;
  redirectUrl?: string;
} {
  return {
    transactionId: res.trxId,
    status: mapDokuPaymentStatus(res.paymentStatus),
    gatewayCode: res.responseCode,
    gatewayMessage: res.responseMessage,
  };
}

function mapDokuPaymentStatus(paymentStatus?: string): PaymentResponseStatus {
  switch (paymentStatus) {
    case 'SUCCESS':
    case 'SUCCEEDED':
      return 'SUCCESS';
    case 'PENDING':
      return 'PENDING';
    case 'FAILED':
      return 'FAILED';
    case 'CANCELED':
      return 'CANCELED';
    case 'EXPIRED':
      return 'EXPIRED';
    default:
      return 'PENDING';
  }
}
