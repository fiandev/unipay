/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/stripe.ts', 'src/xendit.ts', 'src/midtrans.ts', 'src/doku.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
});
