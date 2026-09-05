import { AbstractPaymentGateway } from '../../core/base-gateway.js';
import type { AuthTokenResponse, PaymentRequest, PaymentResponse } from '../../core/types.js';
import { UnipayError } from '../../core/errors.js';
import { XenditConfigSchema } from '../../core/config.js';
import type { XenditConfig } from '../../core/config.js';
import { basicAuthHeader } from '../../core/signature/index.js';
import { toVendorPayload, fromVendorResponse, resolveChannelCode } from './mapper.js';
import type { XenditPaymentRequest } from './types.js';
import { verifyXenditWebhook } from './webhook.js';

const BASE_URL = 'https://api.xendit.co';

export class XenditGateway extends AbstractPaymentGateway {
  private config!: XenditConfig;
  private authHeader!: string;

  public override initialize(config: Record<string, unknown>): void {
    this.validateConfig(config);
    this.config = config as unknown as XenditConfig;
    this.authHeader = basicAuthHeader(this.config.secretApiKey);
    this.setLogger(this.config.debug);
    this.initialized = true;
  }

  protected override validateConfig(config: unknown): void {
    const result = XenditConfigSchema.safeParse(config);
    if (!result.success) {
      throw new UnipayError({
        code: 'CONFIG_INVALID',
        message: `Xendit config validation failed: ${result.error.message}`,
        gateway: 'xendit',
      });
    }
  }

  public async authenticate(): Promise<AuthTokenResponse> {
    return {
      accessToken: this.authHeader,
      tokenType: 'Basic',
      expiresAt: new Date(Date.now() + 31536000 * 1000),
    };
  }

  public async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    const channelCode = resolveChannelCode(request);
    const body = toVendorPayload(request, channelCode);

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
    };

    if (request.metadata?.forUserId) {
      headers['for-user-id'] = String(request.metadata.forUserId);
    }

    const idempotencyKey = request.idempotencyKey ?? request.referenceId;
    headers['X-IDEMPOTENCY-KEY'] = idempotencyKey;

    const res = await this.apiRequest<XenditPaymentRequest | XenditErrorResponse>(
      `${BASE_URL}/v3/payment_requests`,
      {
        method: 'POST',
        headers,
        body,
      },
    );

    if (res.status >= 400) {
      const errBody = res.body as XenditErrorResponse;
      throw new UnipayError({
        code: 'GATEWAY_ERROR',
        message: errBody?.message ?? 'Xendit payment creation failed',
        gateway: 'xendit',
        gatewayCode: errBody?.error_code,
        httpStatus: res.status,
        raw: res.body,
      });
    }

    const xenditResponse = res.body as XenditPaymentRequest;
    const mapped = fromVendorResponse(xenditResponse);

    return {
      gateway: 'xendit',
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
    const res = await this.apiRequest<XenditPaymentRequest | XenditErrorResponse>(
      `${BASE_URL}/v3/payment_requests/${transactionId}`,
      {
        method: 'GET',
        headers: {
          Authorization: this.authHeader,
        },
      },
    );

    if (res.status >= 400) {
      const errBody = res.body as XenditErrorResponse;
      throw new UnipayError({
        code: 'GATEWAY_ERROR',
        message: errBody?.message ?? 'Failed to get Xendit payment status',
        gateway: 'xendit',
        gatewayCode: errBody?.error_code,
        httpStatus: res.status,
        raw: res.body,
      });
    }

    const xenditResponse = res.body as XenditPaymentRequest;
    const mapped = fromVendorResponse(xenditResponse);

    return {
      gateway: 'xendit',
      transactionId: mapped.transactionId,
      referenceId: xenditResponse.reference_id,
      status: mapped.status,
      amount: xenditResponse.request_amount ?? xenditResponse.amount ?? 0,
      currency: xenditResponse.currency,
      gatewayCode: mapped.gatewayCode,
      gatewayMessage: mapped.gatewayMessage,
      redirectUrl: mapped.redirectUrl,
      rawResponse: res.body,
    };
  }

  public async refundPayment(transactionId: string, amount?: number): Promise<PaymentResponse> {
    const body: Record<string, unknown> = {};
    if (amount !== undefined) {
      body.amount = amount;
    }

    const res = await this.apiRequest<XenditPaymentRequest | XenditErrorResponse>(
      `${BASE_URL}/v3/payment_requests/${transactionId}/refunds`,
      {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
        },
        body,
      },
    );

    if (res.status >= 400) {
      const errBody = res.body as XenditErrorResponse;
      throw new UnipayError({
        code: 'GATEWAY_ERROR',
        message: errBody?.message ?? 'Xendit refund failed',
        gateway: 'xendit',
        gatewayCode: errBody?.error_code,
        httpStatus: res.status,
        raw: res.body,
      });
    }

    const xenditResponse = res.body as XenditPaymentRequest;
    return {
      gateway: 'xendit',
      transactionId: xenditResponse.id,
      referenceId: xenditResponse.reference_id,
      status: 'REFUNDED',
      amount: xenditResponse.request_amount ?? xenditResponse.amount ?? 0,
      currency: xenditResponse.currency,
      rawResponse: res.body,
    };
  }

  public handleWebhook(
    payload: string,
    callbackTokenHeader: string | null | undefined,
  ): { eventType: string; transactionId: string; raw: unknown } {
    if (!this.config.webhookVerificationToken) {
      throw new UnipayError({
        code: 'CONFIG_INVALID',
        message: 'Xendit webhook verification token not configured',
        gateway: 'xendit',
      });
    }
    return verifyXenditWebhook(payload, callbackTokenHeader, this.config.webhookVerificationToken);
  }
}

interface XenditErrorResponse {
  error_code?: string;
  message?: string;
}
