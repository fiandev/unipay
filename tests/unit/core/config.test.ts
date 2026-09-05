import { describe, it, expect } from 'vitest';
import {
  StripeConfigSchema,
  XenditConfigSchema,
  MidtransConfigSchema,
  DokuConfigSchema,
} from '../../../src/core/config.js';

describe('StripeConfigSchema', () => {
  it('accepts valid minimal config', () => {
    const result = StripeConfigSchema.parse({ secretKey: 'sk_test_123' });
    expect(result.secretKey).toBe('sk_test_123');
    expect(result.debug).toBe(false);
  });

  it('rejects missing secretKey', () => {
    expect(() => StripeConfigSchema.parse({})).toThrow();
  });
});

describe('XenditConfigSchema', () => {
  it('accepts valid minimal config', () => {
    const result = XenditConfigSchema.parse({ secretApiKey: 'xnd_123' });
    expect(result.secretApiKey).toBe('xnd_123');
  });

  it('rejects empty secretApiKey', () => {
    expect(() => XenditConfigSchema.parse({ secretApiKey: '' })).toThrow();
  });
});

describe('MidtransConfigSchema', () => {
  it('accepts valid config with only serverKey', () => {
    const result = MidtransConfigSchema.parse({ serverKey: 'SB-Mid-server-abc' });
    expect(result.serverKey).toBe('SB-Mid-server-abc');
    expect(result.isProduction).toBe(false);
  });

  it('accepts config with optional clientKey', () => {
    const result = MidtransConfigSchema.parse({
      serverKey: 'SB-Mid-server-abc',
      clientKey: 'SB-Mid-client-xyz',
    });
    expect(result.clientKey).toBe('SB-Mid-client-xyz');
  });

  it('rejects missing serverKey', () => {
    expect(() => MidtransConfigSchema.parse({})).toThrow();
  });

  it('rejects empty serverKey', () => {
    expect(() => MidtransConfigSchema.parse({ serverKey: '' })).toThrow();
  });
});

describe('DokuConfigSchema', () => {
  it('accepts valid config', () => {
    const result = DokuConfigSchema.parse({
      clientId: 'MCC-123',
      secretKey: 'SK-123',
      privateKey: '-----BEGIN PRIVATE KEY-----\n...',
    });
    expect(result.clientId).toBe('MCC-123');
    expect(result.isProduction).toBe(false);
  });

  it('rejects missing clientId', () => {
    expect(() =>
      DokuConfigSchema.parse({ secretKey: 'SK', privateKey: 'PK' }),
    ).toThrow();
  });

  it('rejects missing privateKey', () => {
    expect(() =>
      DokuConfigSchema.parse({ clientId: 'MCC', secretKey: 'SK' }),
    ).toThrow();
  });
});
