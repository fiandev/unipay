export interface DokuAccessTokenRequest {
  grantType: string;
}

export interface DokuAccessTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  additionalInfo?: string;
}

export interface DokuCreateVaRequest {
  partnerReferenceNo: string;
  amount: {
    value: string;
    currency: string;
  };
  virtualAccountName: string;
  virtualAccountEmail?: string;
  virtualAccountPhone?: string;
  trxId?: string;
  customerNo?: string;
  expiryTime?: string;
}

export interface DokuCreateVaResponse {
  responseCode: string;
  responseMessage: string;
  partnerReferenceNo: string;
  virtualAccountData?: {
    partnerServiceId: string;
    customerNo: string;
    virtualAccountNo: string;
    virtualAccountName: string;
    virtualAccountEmail?: string;
    virtualAccountPhone?: string;
    trxId: string;
    howToPayPage: string;
    howToPayApi: string;
  };
}

export interface DokuH2hRequest {
  partnerReferenceNo: string;
  amount: {
    value: string;
    currency: string;
  };
  paymentMethod?: {
    type: string;
    code?: string;
  };
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    country?: string;
  };
  urlParam?: {
    url?: string;
    returnUrl?: string;
  };
  trxId?: string;
}

export interface DokuH2hResponse {
  responseCode: string;
  responseMessage: string;
  partnerReferenceNo: string;
  trxId?: string;
  amount?: {
    value: string;
    currency: string;
  };
  paymentStatus?: string;
  redirectUrl?: string;
}

export interface DokuStatusRequest {
  partnerReferenceNo: string;
  trxId?: string;
  originalPartnerReferenceNo?: string;
  originalExternalId?: string;
  serviceCode?: string;
}

export interface DokuStatusResponse {
  responseCode: string;
  responseMessage: string;
  partnerReferenceNo: string;
  trxId: string;
  amount?: {
    value: string;
    currency: string;
  };
  originalPartnerReferenceNo?: string;
  paymentStatus?: string;
  transactionStatus?: string;
}

export interface DokuWebhookPayload {
  partnerReferenceNo: string;
  trxId: string;
  amount?: {
    value: string;
    currency: string;
  };
  paymentStatus?: string;
  transactionStatus?: string;
  additionalInfo?: Record<string, unknown>;
}
