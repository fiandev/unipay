/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import { describe, it, expect } from 'vitest';
import { UnipayError, isUnipayError } from '../../../src/core/errors.js';

describe('UnipayError', () => {
  it('creates error with required fields', () => {
    const err = new UnipayError({ code: 'CONFIG_INVALID', message: 'invalid config' });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('UnipayError');
    expect(err.code).toBe('CONFIG_INVALID');
    expect(err.message).toBe('invalid config');
  });

  it('creates error with all optional fields', () => {
    const raw = { msg: 'declined' };
    const err = new UnipayError({
      code: 'GATEWAY_ERROR',
      message: 'card declined',
      gateway: 'stripe',
      gatewayCode: 'card_declined',
      httpStatus: 402,
      raw,
    });
    expect(err.gateway).toBe('stripe');
    expect(err.gatewayCode).toBe('card_declined');
    expect(err.httpStatus).toBe(402);
    expect(err.raw).toBe(raw);
  });
});

describe('isUnipayError', () => {
  it('returns true for UnipayError instance', () => {
    expect(isUnipayError(new UnipayError({ code: 'TIMEOUT', message: 'x' }))).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isUnipayError(new Error('plain'))).toBe(false);
  });

  it('returns false for string', () => {
    expect(isUnipayError('some string')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isUnipayError(undefined)).toBe(false);
  });
});
