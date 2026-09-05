/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

/**
 * Script to verify that internal vendor types are NOT leaked into the public
 * dist/index.d.ts after build. Exits with code 0 if clean, 1 if leaks found.
 *
 * Usage: bun run scripts/check-no-internal-leak.ts
 * Requires: build must have been run first (dist/ must exist)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const INTERNAL_TYPE_NAMES = [
  'StripePaymentIntent',
  'StripePaymentIntentStatus',
  'StripeNextAction',
  'StripePaymentError',
  'StripeWebhookPayload',
  'StripeWebhookHeaders',
  'StripeWebhookResult',
  'XenditPaymentRequest',
  'XenditPaymentRequestStatus',
  'XenditCustomer',
  'XenditAddress',
  'XenditItem',
  'XenditAction',
  'XenditWebhookPayload',
  'XenditWebhookResult',
  'MidtransChargeRequest',
  'MidtransChargeResponse',
  'MidtransStatusResponse',
  'MidtransNotificationPayload',
  'MidtransItem',
  'MidtransCustomer',
  'MidtransAddress',
  'MidtransTransactionStatus',
  'MidtransFraudStatus',
  'MidtransWebhookResult',
  'DokuAccessTokenRequest',
  'DokuAccessTokenResponse',
  'DokuCreateVaRequest',
  'DokuCreateVaResponse',
  'DokuH2hRequest',
  'DokuH2hResponse',
  'DokuStatusRequest',
  'DokuStatusResponse',
  'DokuWebhookPayload',
  'DokuWebhookResult',
];

const DIST_DTS = resolve(import.meta.dirname, '..', 'dist', 'index.d.ts');

if (!existsSync(DIST_DTS)) {
  console.error('dist/index.d.ts not found. Run `bun run build` first.');
  process.exit(1);
}

const content = readFileSync(DIST_DTS, 'utf-8');
const leaks: string[] = [];

for (const typeName of INTERNAL_TYPE_NAMES) {
  const regex = new RegExp(`\\b${typeName}\\b`);
  if (regex.test(content)) {
    leaks.push(typeName);
  }
}

if (leaks.length > 0) {
  console.error(`❌ Internal type leak detected! Found ${leaks.length} leaked type(s):`);
  for (const name of leaks) {
    console.error(`   - ${name}`);
  }
  process.exit(1);
} else {
  console.log('✅ No internal type leaks detected in dist/index.d.ts');
  process.exit(0);
}
