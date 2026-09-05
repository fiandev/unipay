/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import { StripeGateway } from '../src/gateways/stripe/index.js';

async function main() {
  const gateway = new StripeGateway();
  gateway.initialize({
    secretKey: 'sk_test_placeholder',
    debug: false,
  });

  const response = await gateway.createPayment({
    amount: 2000,
    currency: 'usd',
    referenceId: 'order-123',
    description: 'Test payment',
    paymentMethod: 'card',
  });

  console.log('Stripe response:', response.transactionId, response.status);
}

main().catch(console.error);
