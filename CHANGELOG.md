# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-18

### Added

- Initial release
- Universal `PaymentRequest` / `PaymentResponse` interface
- Stripe gateway adapter (`unipay/stripe`)
- Xendit gateway adapter (`unipay/xendit`) — v3 API
- Midtrans gateway adapter (`unipay/midtrans`) — Classic Core API v2
- Doku gateway adapter (`unipay/doku`) — SNAP endpoints (VA, H2H)
- `UnipayClient` facade for multi-gateway setups
- Webhook signature verification for all gateways
- HMAC-SHA512, RSA-SHA256, AES-CBC, SHA-256 signature utilities
- Zod-based config validation
- Runtime-agnostic (Bun, Node.js >= 18, Deno, edge runtimes)
- Dual ESM + CJS output via tsup
- Comprehensive test suite (unit, contract, integration)
- CI pipeline (GitHub Actions) with Node 20/22 + Bun matrix
- E2E sandbox test templates
