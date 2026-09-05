/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import { DokuGateway } from '../src/gateways/doku/index.js';

async function main() {
  const gateway = new DokuGateway();
  gateway.initialize({
    clientId: 'doku-client-placeholder',
    secretKey: 'doku-secret-placeholder',
    privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAK...\n-----END RSA PRIVATE KEY-----',
    isProduction: false,
    debug: false,
  });

  const response = await gateway.createPayment({
    amount: 75000,
    currency: 'IDR',
    referenceId: 'doku-order-101',
    paymentMethod: 'va',
    customer: { name: 'Test User', email: 'test@example.com' },
  });

  console.log('Doku response:', response.transactionId, response.status);
}

main().catch(console.error);
