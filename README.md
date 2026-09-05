# unipay-sdk

Universal TypeScript SDK for payment gateways — one API, zero vendor SDK dependencies.

**Supported gateways:** Stripe, Xendit, Midtrans, Doku

## Features

- Single `PaymentRequest` / `PaymentResponse` interface across all gateways
- Zero vendor SDK dependencies — all communication via `fetch` + custom crypto
- Runtime-agnostic (Bun, Node.js >= 18, Deno, edge runtimes)
- Dual ESM + CJS output
- Type-safe with strict TypeScript
- Webhook signature verification for all gateways

## Installation

```bash
# npm
npm install unipay-sdk

# yarn
yarn add unipay-sdk

# pnpm
pnpm add unipay-sdk

# bun
bun add unipay-sdk
```

## Quick Start

```typescript
import { StripeGateway } from 'unipay-sdk/stripe';

const gateway = new StripeGateway();
gateway.initialize({
  secretKey: 'sk_test_...',
});

const response = await gateway.createPayment({
  amount: 2000,
  currency: 'usd',
  referenceId: 'order-123',
  description: 'Test payment',
  paymentMethod: 'card',
});

console.log(response.status); // 'PENDING', 'SUCCESS', etc.
```

## Gateway Examples

### Stripe

```typescript
import { StripeGateway } from 'unipay-sdk/stripe';

const gateway = new StripeGateway();
gateway.initialize({ secretKey: 'sk_test_...' });

// Card payment
const response = await gateway.createPayment({
  amount: 2000,
  currency: 'usd',
  referenceId: 'order-123',
  paymentMethod: 'card',
});

// Check status
const status = await gateway.getPaymentStatus(response.transactionId);
```

### Xendit

```typescript
import { XenditGateway } from 'unipay-sdk/xendit';

const gateway = new XenditGateway();
gateway.initialize({ secretApiKey: 'xnd_...' });

// E-wallet payment
const response = await gateway.createPayment({
  amount: 50000,
  currency: 'IDR',
  referenceId: 'order-456',
  paymentMethod: 'ewallet',
  country: 'ID',
});
```

### Midtrans

```typescript
import { MidtransGateway } from 'unipay-sdk/midtrans';

const gateway = new MidtransGateway();
gateway.initialize({
  serverKey: 'SB-Mid-server-...',
  clientKey: 'SB-Mid-client-...',
  isProduction: false,
});

// Bank transfer (BCA VA)
const response = await gateway.createPayment({
  amount: 100000,
  currency: 'IDR',
  referenceId: 'order-789',
  paymentMethod: 'bank_transfer',
  bank: 'bca',
});
```

### Doku

```typescript
import { DokuGateway } from 'unipay-sdk/doku';

const gateway = new DokuGateway();
gateway.initialize({
  clientId: 'doku-client-...',
  secretKey: 'doku-secret-...',
  privateKey: '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----',
  isProduction: false,
});

// Virtual Account
const response = await gateway.createPayment({
  amount: 75000,
  currency: 'IDR',
  referenceId: 'order-101',
  paymentMethod: 'va',
  customer: { name: 'John Doe', email: 'john@example.com' },
});
```

## Using the UnipayClient Facade

For multi-gateway setups, use the `UnipayClient` facade:

```typescript
import { UnipayClient } from 'unipay-sdk';

const client = new UnipayClient({
  gateways: {
    stripe: { secretKey: 'sk_test_...' },
    xendit: { secretApiKey: 'xnd_...' },
  },
});

// Use any configured gateway
const stripe = client.use('stripe');
const response = await stripe.createPayment({ ... });
```

## Webhook Verification

```typescript
import { verifyWebhook } from 'unipay-sdk';

const event = verifyWebhook('stripe', payload, headers, webhookSecret, {
  throwOnInvalid: true, // default
});

if (event.verified) {
  console.log('Webhook verified:', event.eventType, event.transactionId);
}
```

## Supported Payment Methods

| Gateway  | Card | E-wallet | Bank Transfer | VA  | QRIS |
| -------- | ---- | -------- | ------------- | --- | ---- |
| Stripe   | Yes  | --       | --            | --  | --   |
| Xendit   | --   | Yes      | --            | --  | --   |
| Midtrans | Yes  | Yes      | Yes           | Yes | Yes  |
| Doku     | --   | Yes      | --            | Yes | --   |

## Known Assumptions

The following areas require validation against a real sandbox account before production use:

- **Doku VA & H2H payload structures** (`src/gateways/doku/mapper.ts`): The request body structures for Virtual Account creation and Host-to-Host payments are based on Doku SNAP documentation. Verify against the latest official Doku API docs before going live.

- **Doku card binding**: Not implemented in v1. Use Doku.js client-side tokenization for card tokenization flows.

- **Midtrans status mapping**: The SDK maps Midtrans `transaction_status` + `fraud_status` combinations to a universal status. Verify the mapping matches your expected behavior for edge cases like `challenge` fraud status.

- **Midtrans Classic Core API v2**: This SDK uses the classic Core API v2 (`/v2/charge` with Basic Auth), not the newer BI-SNAP token-exchange variant. See [Reconciliation Notes](docs/reconciliation-notes.md) for why.

- **Xendit v3 API**: Uses v3 (`/v3/payment_requests`) with `request_amount` field (not `amount`). See [Reconciliation Notes](docs/reconciliation-notes.md) for details.

## Architecture

See [Adding a Gateway](docs/adding-a-gateway.md) for the extension pattern.

See [Reconciliation Notes](docs/reconciliation-notes.md) for decisions on API versioning and endpoint selection.

## Development

```bash
# Install dependencies
bun install

# Run tests
bun run test

# Run tests with coverage
bun run test -- --coverage

# Type check
bun run typecheck

# Lint
bun run lint

# Build
bun run build

# Run e2e sandbox tests (requires env vars)
bun run test:e2e
```

## License

MIT
