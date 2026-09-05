# Adding a Gateway

This guide explains how to add a new payment gateway adapter to unipay-sdk.

## Architecture Overview

Every gateway adapter lives in `src/gateways/<vendor>/` and follows this structure:

```
src/gateways/<vendor>/
├── index.ts      # Gateway class extending AbstractPaymentGateway
├── mapper.ts     # Request/response mapping (universal ↔ vendor)
├── types.ts      # Raw vendor payload types (NOT exported to consumers)
└── webhook.ts    # Webhook signature verification + event parsing
```

## Step-by-Step

### 1. Define vendor types

Create `src/gateways/<vendor>/types.ts` with the raw request/response shapes from the vendor's API docs. These types are **internal only** — consumers never see them.

```typescript
export interface MyVendorCreateRequest {
  amount: number;
  currency: string;
  // ...vendor-specific fields
}

export interface MyVendorCreateResponse {
  id: string;
  status: string;
  // ...vendor-specific fields
}
```

### 2. Create the mapper

Create `src/gateways/<vendor>/mapper.ts` with functions to convert between universal types and vendor types:

- `toVendorPayload(request: PaymentRequest): MyVendorCreateRequest` — maps `PaymentRequest` to the vendor's expected body
- `fromVendorResponse(res: MyVendorCreateResponse, referenceId: string): { transactionId, status, ... }` — maps vendor response to universal shape
- A status mapping function that converts vendor-specific status strings to `PaymentResponseStatus`

### 3. Implement the gateway class

Create `src/gateways/<vendor>/index.ts`:

```typescript
import { AbstractPaymentGateway } from '../../core/base-gateway.js';
import type { PaymentRequest, PaymentResponse } from '../../core/types.js';
import { UnipayError } from '../../core/errors.js';
import { VendorConfigSchema } from '../../core/config.js';
import type { VendorConfig } from '../../core/config.js';

const BASE_URL_PRODUCTION = 'https://api.vendor.com';
const BASE_URL_SANDBOX = 'https://sandbox.api.vendor.com';

export class VendorGateway extends AbstractPaymentGateway {
  private config!: VendorConfig;

  public override initialize(config: Record<string, unknown>): void {
    this.validateConfig(config);
    this.config = config as unknown as VendorConfig;
    this.setLogger(this.config.debug);
    this.initialized = true;
  }

  protected override validateConfig(config: unknown): void {
    const result = VendorConfigSchema.safeParse(config);
    if (!result.success) {
      throw new UnipayError({
        code: 'CONFIG_INVALID',
        message: `Config validation failed: ${result.error.message}`,
        gateway: 'vendor',
      });
    }
  }

  public async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    const body = toVendorPayload(request);
    const res = await this.apiRequest<VendorResponse>(`${this.getBaseUrl()}/endpoint`, {
      method: 'POST',
      headers: {/* ... */},
      body,
    });
    // ... error handling + mapping
  }

  public async getPaymentStatus(transactionId: string): Promise<PaymentResponse> {
    // ...
  }

  public async refundPayment(transactionId: string, amount?: number): Promise<PaymentResponse> {
    // ...
  }
}
```

Key conventions:

- **No hardcoded base URLs across methods** — define `BASE_URL_PRODUCTION` and `BASE_URL_SANDBOX` constants at the top of the file
- Extend `AbstractPaymentGateway` and implement all methods from `IPaymentGateway`
- Use `this.apiRequest()` for HTTP calls (handles timeout, retry, error mapping)
- Map vendor errors to `UnipayError` with `code`, `gatewayCode`, `gateway`, `raw`

### 4. Add config schema

In `src/core/config.ts`, add a Zod schema:

```typescript
export const VendorConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  // ...other fields
  isProduction: z.boolean().optional().default(false),
  debug: z.boolean().optional().default(false),
});
```

### 5. Register the gateway

In `src/core/registry.ts`:

1. Add `'vendor'` to the `GatewayName` union in `src/core/types.ts`
2. Add the config type to `GatewayConfigMap` in `src/core/config.ts`
3. Import and register in `createGateway()` switch statement
4. Add to the registry in the `initialize` logic

### 6. Add webhook verification (optional)

If the gateway supports webhooks, create `src/gateways/<vendor>/webhook.ts` and wire it into `src/webhooks/verify.ts`.

### 7. Add subpath export

In `tsup.config.ts`, add the entry point. In `package.json`, add the export map entry:

```json
{
  "exports": {
    "./vendor": {
      "types": "./dist/vendor.d.ts",
      "import": "./dist/vendor.js",
      "require": "./dist/vendor.cjs"
    }
  }
}
```

Create `src/vendor.ts`:

```typescript
export { VendorGateway } from './gateways/vendor/index.js';
```

### 8. Write tests

- `tests/integration/vendor/vendor.test.ts` — mocked HTTP tests with `msw`
- `tests/contract/gateway-contract.test.ts` — add to the `describe.each` array

## Variant Pattern (Multiple Adapters per Vendor)

The registry architecture supports multiple variants per vendor. For example, Midtrans has two distinct products:

- **Classic Core API v2** (`midtrans` adapter) — uses Basic Auth, `/v2/charge` endpoint
- **BI-SNAP** (`midtrans-snap` adapter) — uses token exchange, different endpoints

These are separate adapters in separate directories (`src/gateways/midtrans/` and `src/gateways/midtrans-snap/`), each extending `AbstractPaymentGateway` independently. Both register under the same `GatewayName` union with distinct config shapes.

To add a variant:

1. Create a new directory `src/gateways/<vendor>-<variant>/`
2. Follow the same adapter pattern
3. Add a new config type and register in the registry
4. The `GatewayName` union can have multiple entries for the same vendor (e.g., `'midtrans' | 'midtrans-snap'`)
