import { AbstractPaymentGateway } from '../../core/base-gateway.js';
import type { AuthTokenResponse, PaymentRequest, PaymentResponse } from '../../core/types.js';
import { UnipayError } from '../../core/errors.js';
import { StripeConfigSchema } from '../../core/config.js';
import type { StripeConfig } from '../../core/config.js';
import { toVendorPayload, fromVendorResponse } from './mapper.js';
import type { StripePaymentIntent } from './types.js';
import { verifyStripeWebhook } from './webhook.js';

const BASE_URL = 'https://api.stripe.com';

export class StripeGateway extends AbstractPaymentGateway {
  private config!: StripeConfig;

  public override initialize(config: Record<string, unknown>): void {
    this.validateConfig(config);
    this.config = config as unknown as StripeConfig;
    this.setLogger(this.config.debug);
    this.initialized = true;
  }

  protected override validateConfig(config: unknown): void {
    const result = StripeConfigSchema.safeParse(config);
    if (!result.success) {
      throw new UnipayError({
        code: 'CONFIG_INVALID',
        message: `Stripe config validation failed: ${result.error.message}`,
        gateway: 'stripe',
      });
    }
  }

  public async authenticate(): Promise<AuthTokenResponse> {
    return {
      accessToken: this.config.secretKey,
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 31536000 * 1000),
    };
  }

  public async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    const body = toVendorPayload(request);
    const bodyString = new URLSearchParams(body).toString();

    const res = await this.apiRequest<StripePaymentIntent>(`${BASE_URL}/v1/payment_intents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
      },
      body: bodyString,
      contentType: 'form-urlencoded',
    });

    if (res.status >= 400) {
      const errBody = res.body as { error?: { type?: string; code?: string; message?: string } };
      throw new UnipayError({
        code: 'GATEWAY_ERROR',
        message: errBody?.error?.message ?? 'Stripe payment creation failed',
        gateway: 'stripe',
        gatewayCode: errBody?.error?.code,
        httpStatus: res.status,
        raw: res.body,
      });
    }

    const mapped = fromVendorResponse(res.body, 'stripe');

    return {
      gateway: 'stripe',
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
    const res = await this.apiRequest<StripePaymentIntent>(
      `${BASE_URL}/v1/payment_intents/${transactionId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.secretKey}`,
        },
      },
    );

    if (res.status >= 400) {
      const errBody = res.body as { error?: { code?: string; message?: string } };
      throw new UnipayError({
        code: 'GATEWAY_ERROR',
        message: errBody?.error?.message ?? 'Failed to get Stripe payment status',
        gateway: 'stripe',
        gatewayCode: errBody?.error?.code,
        httpStatus: res.status,
        raw: res.body,
      });
    }

    const mapped = fromVendorResponse(res.body, 'stripe');

    return {
      gateway: 'stripe',
      transactionId: mapped.transactionId,
      referenceId: res.body.metadata?.order_id ?? '',
      status: mapped.status,
      amount: res.body.amount,
      currency: res.body.currency.toUpperCase(),
      gatewayCode: mapped.gatewayCode,
      gatewayMessage: mapped.gatewayMessage,
      redirectUrl: mapped.redirectUrl,
      rawResponse: res.body,
    };
  }

  public async refundPayment(transactionId: string, amount?: number): Promise<PaymentResponse> {
    const body: Record<string, string> = {
      payment_intent: transactionId,
    };
    if (amount !== undefined) {
      body.amount = String(amount);
    }

    const res = await this.apiRequest<{
      id: string;
      status: string;
      amount: number;
      currency: string;
    }>(`${BASE_URL}/v1/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
      },
      body: new URLSearchParams(body).toString(),
      contentType: 'form-urlencoded',
    });

    if (res.status >= 400) {
      const errBody = res.body as { error?: { code?: string; message?: string } };
      throw new UnipayError({
        code: 'GATEWAY_ERROR',
        message: errBody?.error?.message ?? 'Stripe refund failed',
        gateway: 'stripe',
        gatewayCode: errBody?.error?.code,
        httpStatus: res.status,
        raw: res.body,
      });
    }

    return {
      gateway: 'stripe',
      transactionId: res.body.id,
      referenceId: '',
      status: 'REFUNDED',
      amount: res.body.amount,
      currency: res.body.currency.toUpperCase(),
      rawResponse: res.body,
    };
  }

  public async handleWebhook(
    payload: string,
    signatureHeader: string,
  ): Promise<{ eventType: string; transactionId: string; raw: unknown }> {
    if (!this.config.webhookSecret) {
      throw new UnipayError({
        code: 'CONFIG_INVALID',
        message: 'Stripe webhook secret not configured',
        gateway: 'stripe',
      });
    }
    return verifyStripeWebhook(payload, signatureHeader, this.config.webhookSecret);
  }
}
