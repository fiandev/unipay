/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import type { IPaymentGateway, PaymentRequest, PaymentResponse, Logger } from './types.js';
import { request as httpRequest } from './http-client.js';
import type { HttpRequestOptions, HttpResponse } from './http-client.js';

export abstract class AbstractPaymentGateway implements IPaymentGateway {
  protected http: typeof httpRequest;
  protected logger: Logger;
  protected initialized = false;

  public constructor() {
    this.http = httpRequest;
    this.logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
    };
  }

  public abstract createPayment(request: PaymentRequest): Promise<PaymentResponse>;

  public abstract getPaymentStatus(transactionId: string): Promise<PaymentResponse>;

  public abstract refundPayment(transactionId: string, amount?: number): Promise<PaymentResponse>;

  public abstract initialize(config: Record<string, unknown>): void;

  protected abstract validateConfig(config: unknown): void;

  protected setLogger(debug: boolean): void {
    if (debug) {
      this.logger = {
        info: (...args: unknown[]) => console.info('[unipay]', ...args),
        warn: (...args: unknown[]) => console.warn('[unipay]', ...args),
        error: (...args: unknown[]) => console.error('[unipay]', ...args),
      };
    }
  }

  protected async apiRequest<T = unknown>(
    url: string,
    options: HttpRequestOptions,
  ): Promise<HttpResponse<T>> {
    this.logger.info(`API request: ${options.method} ${url}`);
    return this.http<T>(url, options);
  }
}
