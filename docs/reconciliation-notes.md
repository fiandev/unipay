# Reconciliation Notes

This document records key decisions about API versioning and endpoint selection for each gateway. These are not arbitrary choices — they are based on validation against official vendor documentation as of July 2026.

## Summary

| Gateway  | API Version Used    | Auth Method       | Key Endpoint            |
| -------- | ------------------- | ----------------- | ----------------------- |
| Stripe   | v1                  | Bearer token      | `/v1/payment_intents`   |
| Xendit   | v3                  | Secret API key    | `/v3/payment_requests`  |
| Midtrans | Classic Core API v2 | Basic Auth        | `/v2/charge`            |
| Doku     | SNAP (BI-SNAP)      | RSA-SHA256 + HMAC | `/authorization/v1/...` |

## Detailed Decisions

### Xendit — v3 (not v2)

The SDK uses Xendit API **v3** (`POST /v3/payment_requests`) with the `request_amount` field (not `amount` from v2).

**Why v3:**

- v3 is the current recommended version per [Xendit API docs](https://docs.xendit.co/apidocs/create-payment-request)
- Uses `request_amount` instead of `amount` — the field name is intentionally different
- Supports `X-IDEMPOTENCY-KEY` header natively
- Supports `for-user-id` sub-account header

**Key differences from v2:**

- `amount` → `request_amount`
- Different action structure for redirect flows
- Different webhook payload format

Reference: [Xendit Create Payment Request](https://docs.xendit.co/apidocs/create-payment-request)

### Midtrans — Classic Core API v2 (not BI-SNAP)

The SDK uses Midtrans **Classic Core API v2** (`/v2/charge` with Basic Auth using Server Key).

**Why Classic Core API v2:**

- Simpler integration — Basic Auth with Server Key, no token exchange required
- Covers a wide range of payment types (bank_transfer, gopay, credit_card, qris, etc.)
- More commonly used in production integrations
- The more widely documented and supported product

**Why NOT BI-SNAP:**

- BI-SNAP is a different product with a different API surface (token exchange authentication)
- Mixing BI-SNAP into the same adapter would create confusion
- BI-SNAP support can be added as a separate `midtrans-snap` adapter in the future

**Status mapping note:** Midtrans uses `transaction_status` + `fraud_status` fields. The SDK maps these combinations to a universal status. For example, `settlement` + `accept` → `SUCCESS`, `settlement` + `deny` → `FAILED`.

Reference: [Midtrans Core API](https://docs.midtrans.com/docs/core-api)

### Doku — SNAP Endpoints

The SDK uses Doku's SNAP API endpoints:

- **Authentication:** `POST /authorization/v1/access-token/b2b` (RSA-SHA256 signature)
- **VA Creation:** `POST /virtual-accounts/bi-snap-va/v1.1/transfer-va/create-va`
- **H2H Payment:** `POST /direct-debit/core/v1/debit/payment-host-to-host`
- **Status Check:** `POST /service/v1/status`

**Request signing:** HMAC-SHA512 of the JSON body string, using the partner's secret key.

**Important assumptions:**

- VA and H2H payload structures are based on Doku SNAP documentation — verify against the latest official docs before production
- Card binding is out of scope for v1 (use Doku.js client-side tokenization)
- The `CHANNEL-ID: DH` header is hardcoded for H2H flows

### Stripe — v1 Standard

The SDK uses Stripe API **v1** (`/v1/payment_intents`) with form-urlencoded request bodies.

- Standard Bearer token authentication
- Webhook verification via HMAC-SHA256
- 3DS redirect via `next_action.redirect_to_url.url`
- Status mapping follows Stripe's `PaymentIntent` status enum

Reference: [Stripe Payment Intents API](https://docs.stripe.com/api/payment_intents)
