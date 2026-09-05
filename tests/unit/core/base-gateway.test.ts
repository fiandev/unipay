/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AbstractPaymentGateway } from '../../../src/core/base-gateway.js';
import type { PaymentRequest, PaymentResponse } from '../../../src/core/types.js';

class TestGateway extends AbstractPaymentGateway {
  public config: Record<string, unknown> = {};
  public override initialize(config: Record<string, unknown>): void {
    this.config = config;
    this.validateConfig(config);
    if (config.debug) this.setLogger(true);
    this.initialized = true;
  }
  protected override validateConfig(config: unknown): void {
    if (!config || typeof config !== 'object') throw new Error('Invalid config');
  }
  public async createPayment(req: PaymentRequest): Promise<PaymentResponse> {
    return { gateway: 'stripe', transactionId: 'txn_001', referenceId: req.referenceId, status: 'PENDING', amount: req.amount, currency: req.currency };
  }
  public async getPaymentStatus(txnId: string): Promise<PaymentResponse> {
    return { gateway: 'stripe', transactionId: txnId, referenceId: 'ref_001', status: 'SUCCESS', amount: 1000, currency: 'usd' };
  }
  public async refundPayment(txnId: string, amount?: number): Promise<PaymentResponse> {
    return { gateway: 'stripe', transactionId: txnId, referenceId: 'ref_001', status: 'SUCCESS', amount: amount ?? 0, currency: 'usd' };
  }
  public getLogger() { return this.logger; }
  public getInitialized() { return this.initialized; }
}

describe('AbstractPaymentGateway', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('initializes with config', () => {
    const gw = new TestGateway();
    gw.initialize({ apiKey: 'test', debug: false });
    expect(gw.getInitialized()).toBe(true);
    expect(gw.config.apiKey).toBe('test');
  });

  it('throws on invalid config', () => {
    const gw = new TestGateway();
    expect(() => gw.initialize(null as unknown as Record<string, unknown>)).toThrow('Invalid config');
  });

  it('creates payment and returns PaymentResponse', async () => {
    const gw = new TestGateway();
    gw.initialize({ apiKey: 'test' });
    const res = await gw.createPayment({ amount: 5000, currency: 'usd', referenceId: 'order_001' });
    expect(res.transactionId).toBe('txn_001');
    expect(res.amount).toBe(5000);
  });

  it('enables logger when debug is true', () => {
    const gw = new TestGateway();
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    gw.initialize({ apiKey: 'test', debug: true });
    gw.getLogger().info('hello');
    expect(spy).toHaveBeenCalledWith('[unipay]', 'hello');
  });
});
