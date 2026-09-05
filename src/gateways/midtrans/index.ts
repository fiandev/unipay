import { AbstractPaymentGateway } from '../../core/base-gateway.js';
import type { AuthTokenResponse, PaymentRequest, PaymentResponse } from '../../core/types.js';
import { UnipayError } from '../../core/errors.js';
import { MidtransConfigSchema } from '../../core/config.js';
import type { MidtransConfig } from '../../core/config.js';
import { basicAuthHeader } from '../../core/signature/index.js';
import {
  toVendorPayload,
  resolvePaymentType,
  fromChargeResponse,
  fromStatusResponse,
} from './mapper.js';
import type { MidtransChargeResponse, MidtransStatusResponse } from './types.js';
import { verifyMidtransWebhook } from './webhook.js';

const BASE_URL_PRODUCTION = 'https://api.midtrans.com';
const BASE_URL_SANDBOX = 'https://api.sandbox.midtrans.com';

export class MidtransGateway extends AbstractPaymentGateway {
  private config!: MidtransConfig;
  private authHeader!: string;

  public override initialize(config: Record<string, unknown>): void {
    this.validateConfig(config);
    this.config = config as unknown as MidtransConfig;
    this.authHeader = basicAuthHeader(this.config.serverKey);
    this.setLogger(this.config.debug);
    this.initialized = true;
  }

  protected override validateConfig(config: unknown): void {
    const result = MidtransConfigSchema.safeParse(config);
    if (!result.success) {
      throw new UnipayError({
        code: 'CONFIG_INVALID',
        message: `Midtrans config validation failed: ${result.error.message}`,
        gateway: 'midtrans',
      });
    }
  }

  private getBaseUrl(): string {
    return this.config.isProduction ? BASE_URL_PRODUCTION : BASE_URL_SANDBOX;
  }

  public async authenticate(): Promise<AuthTokenResponse> {
    return {
      accessToken: this.authHeader,
      tokenType: 'Basic',
      expiresAt: new Date(Date.now() + 31536000 * 1000),
    };
  }

  public async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    const paymentType = resolvePaymentType(request.paymentMethod);
    const body = toVendorPayload(request, paymentType);

    const res = await this.apiRequest<MidtransChargeResponse | MidtransErrorResponse>(
      `${this.getBaseUrl()}/v2/charge`,
      {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
        },
        body: body as unknown as Record<string, unknown>,
      },
    );

    if (res.status >= 400) {
      const errBody = res.body as MidtransErrorResponse;
      throw new UnipayError({
        code: 'GATEWAY_ERROR',
        message: errBody?.status_message ?? 'Midtrans payment creation failed',
        gateway: 'midtrans',
        gatewayCode: errBody?.status_code,
        httpStatus: res.status,
        raw: res.body,
      });
    }

    const chargeRes = res.body as MidtransChargeResponse;

    if (
      chargeRes.status_code &&
      chargeRes.status_code !== '201' &&
      chargeRes.status_code !== '200'
    ) {
      throw new UnipayError({
        code: 'GATEWAY_ERROR',
        message: chargeRes.status_message ?? 'Midtrans payment creation failed',
        gateway: 'midtrans',
        gatewayCode: chargeRes.status_code,
        httpStatus: res.status,
        raw: res.body,
      });
    }

    const mapped = fromChargeResponse(chargeRes, request.referenceId);

    return {
      gateway: 'midtrans',
      transactionId: mapped.transactionId,
      referenceId: request.referenceId,
      status: mapped.status,
      amount: request.amount,
      currency: request.currency,
      gatewayCode: mapped.gatewayCode,
      gatewayMessage: mapped.gatewayMessage,
      redirectUrl: mapped.redirectUrl,
      rawResponse: res.body,
    };
  }

  public async getPaymentStatus(transactionId: string): Promise<PaymentResponse> {
    const res = await this.apiRequest<MidtransStatusResponse | MidtransErrorResponse>(
      `${this.getBaseUrl()}/v2/${transactionId}/status`,
      {
        method: 'GET',
        headers: {
          Authorization: this.authHeader,
        },
      },
    );

    if (res.status >= 400) {
      const errBody = res.body as MidtransErrorResponse;
      throw new UnipayError({
        code: 'GATEWAY_ERROR',
        message: errBody?.status_message ?? 'Failed to get Midtrans payment status',
        gateway: 'midtrans',
        gatewayCode: errBody?.status_code,
        httpStatus: res.status,
        raw: res.body,
      });
    }

    const statusRes = res.body as MidtransStatusResponse;
    const mapped = fromStatusResponse(statusRes, statusRes.order_id);

    return {
      gateway: 'midtrans',
      transactionId: mapped.transactionId,
      referenceId: statusRes.order_id,
      status: mapped.status,
      amount: parseFloat(statusRes.gross_amount),
      currency: 'IDR',
      gatewayCode: mapped.gatewayCode,
      gatewayMessage: mapped.gatewayMessage,
      redirectUrl: mapped.redirectUrl,
      rawResponse: res.body,
    };
  }

  public async refundPayment(transactionId: string, amount?: number): Promise<PaymentResponse> {
    const body: Record<string, unknown> = {};
    if (amount !== undefined) {
      body.refund_amount = amount;
    }

    const res = await this.apiRequest<MidtransChargeResponse | MidtransErrorResponse>(
      `${this.getBaseUrl()}/v2/${transactionId}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
        },
        body,
      },
    );

    if (res.status >= 400) {
      const errBody = res.body as MidtransErrorResponse;
      throw new UnipayError({
        code: 'GATEWAY_ERROR',
        message: errBody?.status_message ?? 'Midtrans refund failed',
        gateway: 'midtrans',
        gatewayCode: errBody?.status_code,
        httpStatus: res.status,
        raw: res.body,
      });
    }

    const refundRes = res.body as MidtransChargeResponse;
    return {
      gateway: 'midtrans',
      transactionId: refundRes.transaction_id,
      referenceId: refundRes.order_id,
      status: 'REFUNDED',
      amount: parseFloat(refundRes.gross_amount),
      currency: 'IDR',
      gatewayCode: refundRes.status_code,
      gatewayMessage: refundRes.status_message,
      rawResponse: res.body,
    };
  }

  public async handleWebhook(
    payload: string,
    _signatureHeader?: string,
  ): Promise<{ eventType: string; transactionId: string; raw: unknown }> {
    return verifyMidtransWebhook(payload, this.config.serverKey);
  }
}

interface MidtransErrorResponse {
  status_code?: string;
  status_message?: string;
}
