/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import type { GatewayName, IPaymentGateway } from './types.js';
import { UnipayError } from './errors.js';
import type { GatewayConfig } from './config.js';
import { StripeGateway } from '../gateways/stripe/index.js';
import { XenditGateway } from '../gateways/xendit/index.js';
import { MidtransGateway } from '../gateways/midtrans/index.js';
import { DokuGateway } from '../gateways/doku/index.js';

export function createGateway<T extends GatewayName>(
  name: T,
  config: GatewayConfig[T],
): IPaymentGateway {
  const GatewayClass = gatewayRegistry[name];
  if (!GatewayClass) {
    throw new UnipayError({
      code: 'NOT_IMPLEMENTED',
      message: `Gateway "${name}" is not yet implemented`,
    });
  }
  const instance = new GatewayClass();
  instance.initialize(config as Record<string, unknown>);
  return instance;
}

const gatewayRegistry: Partial<
  Record<
    GatewayName,
    new () => IPaymentGateway & { initialize(config: Record<string, unknown>): void }
  >
> = {
  stripe: StripeGateway,
  xendit: XenditGateway,
  midtrans: MidtransGateway,
  doku: DokuGateway,
};

export function registerGateway(
  name: GatewayName,
  gatewayClass: new () => IPaymentGateway & { initialize(config: Record<string, unknown>): void },
): void {
  gatewayRegistry[name] = gatewayClass;
}
