/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import type { GatewayName } from './types.js';

export type UnipayErrorCode =
  | 'CONFIG_INVALID'
  | 'AUTH_FAILED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'GATEWAY_ERROR'
  | 'VALIDATION_ERROR'
  | 'WEBHOOK_SIGNATURE_INVALID'
  | 'NOT_IMPLEMENTED'
  | 'UNKNOWN';

export class UnipayError extends Error {
  public readonly code: UnipayErrorCode;
  public readonly gateway?: GatewayName;
  public readonly gatewayCode?: string;
  public readonly httpStatus?: number;
  public readonly raw?: unknown;

  public constructor(params: {
    code: UnipayErrorCode;
    message: string;
    gateway?: GatewayName;
    gatewayCode?: string;
    httpStatus?: number;
    raw?: unknown;
    cause?: unknown;
  }) {
    super(params.message, { cause: params.cause });
    this.name = 'UnipayError';
    this.code = params.code;
    this.gateway = params.gateway;
    this.gatewayCode = params.gatewayCode;
    this.httpStatus = params.httpStatus;
    this.raw = params.raw;
  }
}

export function isUnipayError(err: unknown): err is UnipayError {
  return err instanceof UnipayError;
}
