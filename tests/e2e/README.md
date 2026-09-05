# E2E Sandbox Tests

These tests run against real vendor sandbox APIs and require valid credentials. They are **not** included in the default `bun run test` — run them with `bun run test:e2e`.

## Prerequisites

Each vendor requires a sandbox account. Set the following environment variables before running:

### Stripe

- `STRIPE_TEST_KEY` — Stripe test secret key (`sk_test_...`)

Get one at: https://dashboard.stripe.com/test/apikeys

### Xendit

- `XENDIT_TEST_KEY` — Xendit test secret API key

Get one at: https://dashboard.xendit.co/settings/developers/api-keys

### Midtrans

- `MIDTRANS_SERVER_KEY_SANDBOX` — Midtrans sandbox Server Key
- `MIDTRANS_CLIENT_KEY_SANDBOX` — Midtrans sandbox Client Key

Get them at: https://sandbox.midtrans.com/ → Settings → Dashboard → Server/Sandbox Keys

### Doku

- `DOKU_CLIENT_ID_SANDBOX` — Doku sandbox Client ID
- `DOKU_SECRET_KEY_SANDBOX` — Doku sandbox Secret Key
- `DOKU_PRIVATE_KEY_SANDBOX` — Doku sandbox RSA private key (PEM format)

Get them at: https://www.doku.com/ → Partner Dashboard → Sandbox credentials

## Running

```bash
# Run all e2e tests (auto-skips vendors without credentials)
bun run test:e2e

# Run for a specific vendor (with credentials set)
STRIPE_TEST_KEY=sk_test_... bun run test:e2e
```

Tests automatically skip when credentials are not set — this is not a failure, just a skip. External contributors without all sandbox accounts are not blocked.

## Important Notes

- **Doku and Midtrans** e2e tests are mandatory validation before production release (see `PLAN_SDK_3.md`). Do not ship to production without verifying these flows against a real sandbox.
- Tests use official vendor test cards/accounts — no real money is involved.
- Tests run with a 30-second timeout per test to account for network latency.
