/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/unit/**/*.test.ts',
      'tests/unit/**/*.test-d.ts',
      'tests/contract/**/*.test.ts',
      'tests/integration/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        'src/core/**': {
          branches: 90,
          lines: 90,
          functions: 90,
          statements: 90,
        },
        'src/gateways/**': {
          branches: 80,
          lines: 80,
          functions: 80,
          statements: 80,
        },
      },
    },
  },
});
