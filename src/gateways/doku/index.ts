/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import { AbstractPaymentGateway } from '../../core/base-gateway.js';
import type { AuthTokenResponse, PaymentRequest, PaymentResponse } from '../../core/types.js';
import { UnipayError } from '../../core/errors.js';
import { DokuConfigSchema } from '../../core/config.js';
import type { DokuConfig } from '../../core/config.js';
import { rsaSha256Sign, hmacSha512Hex, iso8601Timestamp } from '../../core/signature/index.js';
import {
  resolveEndpoint,
  toCreateVaPayload,
  toH2hPayload,
  toStatusPayload,
  fromCreateVaResponse,
  fromH2hResponse,
  fromStatusResponse,
} from './mapper.js';
import type {
  DokuAccessTokenResponse,
  DokuCreateVaResponse,
  DokuH2hResponse,
  DokuStatusResponse,
} from './types.js';
import { verifyDokuWebhook } from './webhook.js';

const BASE_URL_PRODUCTION = 'https://api.doku.com';
const BASE_URL_SANDBOX = 'https://api-sandbox.doku.com';

export class DokuGateway extends AbstractPaymentGateway {
  private config!: DokuConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  public override initialize(config: Record<string, unknown>): void {
    this.validateConfig(config);
    this.config = config as unknown as DokuConfig;
    this.setLogger(this.config.debug);
    this.initialized = true;
  }

  protected override validateConfig(config: unknown): void {
    const result = DokuConfigSchema.safeParse(config);
    if (!result.success) {
      throw new UnipayError({
        code: 'CONFIG_INVALID',
        message: `Doku config validation failed: ${result.error.message}`,
        gateway: 'doku',
      });
    }
  }

  private getBaseUrl(): string {
    return this.config.isProduction ? BASE_URL_PRODUCTION : BASE_URL_SANDBOX;
  }

  private isTokenValid(): boolean {
    if (!this.accessToken || !this.tokenExpiresAt) return false;
    return new Date() < this.tokenExpiresAt;
  }

  public async authenticate(): Promise<AuthTokenResponse> {
    if (this.isTokenValid() && this.accessToken && this.tokenExpiresAt) {
      return {
        accessToken: this.accessToken,
        tokenType: 'Bearer',
        expiresAt: this.tokenExpiresAt,
      };
    }

    const timestamp = iso8601Timestamp('Z');
    const signaturePayload = `${this.config.clientId}|${timestamp}`;
    const signature = await rsaSha256Sign(signaturePayload, this.config.privateKey);

    const res = await this.apiRequest<DokuAccessTokenResponse>(
      `${this.getBaseUrl()}/authorization/v1/access-token/b2b`,
      {
        method: 'POST',
        headers: {
          'X-SIGNATURE': signature,
          'X-TIMESTAMP': timestamp,
          'X-CLIENT-KEY': this.config.clientId,
          'Content-Type': 'application/json',
        },
        body: { grantType: 'client_credentials' },
      },
    );

    if (res.status >= 400) {
      throw new UnipayError({
        code: 'AUTH_FAILED',
        message: 'Doku authentication failed',
        gateway: 'doku',
        httpStatus: res.status,
        raw: res.body,
      });
    }

    const tokenRes = res.body as DokuAccessTokenResponse;
    this.accessToken = tokenRes.accessToken;
    this.tokenExpiresAt = new Date(Date.now() + (tokenRes.expiresIn ?? 3600) * 1000);

    return {
      accessToken: this.accessToken,
      tokenType: tokenRes.tokenType ?? 'Bearer',
      expiresAt: this.tokenExpiresAt,
    };
  }

  public async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    const auth = await this.authenticate();
    const endpoint = resolveEndpoint(request.paymentMethod);

    const isVa = request.paymentMethod === 'va' || request.paymentMethod === 'bank_transfer';
    const body = isVa ? toCreateVaPayload(request) : toH2hPayload(request);

    const timestamp = iso8601Timestamp('Z');
    const bodyString = JSON.stringify(body);
    const signature = await hmacSha512Hex(bodyString, this.config.secretKey);

    const externalId =
      request.idempotencyKey ?? `${request.referenceId}-${new Date().toISOString().slice(0, 10)}`;

    const headers: Record<string, string> = {
      'X-PARTNER-ID': this.config.clientId,
      'X-EXTERNAL-ID': externalId,
      Authorization: `Bearer ${auth.accessToken}`,
      'X-TIMESTAMP': timestamp,
      'X-SIGNATURE': signature,
      'CHANNEL-ID': 'DH',
      'Content-Type': 'application/json',
    };

    const res = await this.apiRequest<DokuCreateVaResponse | DokuH2hResponse>(
      `${this.getBaseUrl()}${endpoint}`,
      {
        method: 'POST',
        headers,
        body: body as unknown as Record<string, unknown>,
      },
    );

    if (res.status >= 400) {
      const errBody = res.body as { responseCode?: string; responseMessage?: string };
      throw new UnipayError({
        code: 'GATEWAY_ERROR',
        message: errBody?.responseMessage ?? 'Doku payment creation failed',
        gateway: 'doku',
        gatewayCode: errBody?.responseCode,
        httpStatus: res.status,
        raw: res.body,
      });
    }

    if (isVa) {
      const vaRes = res.body as DokuCreateVaResponse;
      const mapped = fromCreateVaResponse(vaRes, request.referenceId);
      return {
        gateway: 'doku',
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

    const h2hRes = res.body as DokuH2hResponse;
    const mapped = fromH2hResponse(h2hRes, request.referenceId);
    return {
      gateway: 'doku',
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
    const auth = await this.authenticate();
    const body = toStatusPayload(transactionId);

    const timestamp = iso8601Timestamp('Z');
    const bodyString = JSON.stringify(body);
    const signature = await hmacSha512Hex(bodyString, this.config.secretKey);

    const externalId = `${transactionId}-${new Date().toISOString().slice(0, 10)}`;

    const headers: Record<string, string> = {
      'X-PARTNER-ID': this.config.clientId,
      'X-EXTERNAL-ID': externalId,
      Authorization: `Bearer ${auth.accessToken}`,
      'X-TIMESTAMP': timestamp,
      'X-SIGNATURE': signature,
      'CHANNEL-ID': 'DH',
      'Content-Type': 'application/json',
    };

    const res = await this.apiRequest<DokuStatusResponse>(
      `${this.getBaseUrl()}/service/v1/status`,
      {
        method: 'POST',
        headers,
        body: body as unknown as Record<string, unknown>,
      },
    );

    if (res.status >= 400) {
      const errBody = res.body as { responseCode?: string; responseMessage?: string };
      throw new UnipayError({
        code: 'GATEWAY_ERROR',
        message: errBody?.responseMessage ?? 'Failed to get Doku payment status',
        gateway: 'doku',
        gatewayCode: errBody?.responseCode,
        httpStatus: res.status,
        raw: res.body,
      });
    }

    const statusRes = res.body as DokuStatusResponse;
    const mapped = fromStatusResponse(statusRes, statusRes.partnerReferenceNo);

    const amountVal = statusRes.amount?.value ? parseFloat(statusRes.amount.value) : 0;

    return {
      gateway: 'doku',
      transactionId: mapped.transactionId,
      referenceId: statusRes.partnerReferenceNo,
      status: mapped.status,
      amount: amountVal,
      currency: statusRes.amount?.currency ?? 'IDR',
      gatewayCode: mapped.gatewayCode,
      gatewayMessage: mapped.gatewayMessage,
      rawResponse: res.body,
    };
  }

  public async refundPayment(_transactionId: string, _amount?: number): Promise<PaymentResponse> {
    throw new UnipayError({
      code: 'NOT_IMPLEMENTED',
      message:
        'Doku refund is not implemented in this version. Use the Doku dashboard for refunds.',
      gateway: 'doku',
    });
  }

  public async handleWebhook(
    payload: string,
    signatureHeader?: string,
  ): Promise<{ eventType: string; transactionId: string; raw: unknown }> {
    return verifyDokuWebhook(payload, signatureHeader, this.config.secretKey);
  }

  public async cardBinding(_request: PaymentRequest): Promise<unknown> {
    // ASUMSI STRUKTUR — card binding is out of scope for v1
    throw new UnipayError({
      code: 'NOT_IMPLEMENTED',
      message:
        'Doku card binding is not implemented in this version. Use Doku.js client-side tokenization instead.',
      gateway: 'doku',
    });
  }
}
