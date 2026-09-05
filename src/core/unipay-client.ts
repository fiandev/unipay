import type { GatewayName, IPaymentGateway } from './types.js';
import type { GatewayConfig } from './config.js';
import { UnipayError } from './errors.js';
import { createGateway } from './registry.js';

export class UnipayClient {
  private gateways = new Map<GatewayName, IPaymentGateway>();

  public constructor(config: { gateways: Partial<GatewayConfig> }) {
    for (const [name, gwConfig] of Object.entries(config.gateways)) {
      if (gwConfig) {
        const gateway = createGateway(name as GatewayName, gwConfig);
        this.gateways.set(name as GatewayName, gateway);
      }
    }
  }

  public use<T extends GatewayName>(name: T): IPaymentGateway {
    const gateway = this.gateways.get(name);
    if (!gateway) {
      throw new UnipayError({
        code: 'NOT_IMPLEMENTED',
        message: `Gateway "${name}" is not configured`,
      });
    }
    return gateway;
  }
}
