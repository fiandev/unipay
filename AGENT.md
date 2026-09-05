# AGENT.md

This document serves as the **working contract** for agent working on the **unipay** repository. Read this document first before touching any code, then follow `PLAN_SDK_1.md` and `PLAN_TEST_1.md` as the source of truth for the order of implementation.

---

## 1. What is unipay

`unipay` is a TypeScript SDK that provides **one universal API** for communicating with various payment gateways (Doku, Midtrans, Xendit, Stripe, and other gateways in the future) **without depending on each vendor's official SDK**. All communication is performed directly to the vendor's REST API using `fetch`.

The foundational type contracts (`PaymentRequest`, `PaymentResponse`, `IPaymentGateway`, `AbstractPaymentGateway`, etc.) are already defined in `payment_gateway_contracts.ts` provided by the user — **this is the baseline, not a final draft**. Agents may extend it (adding fields, adding new gateways to the union type) but are **prohibited from changing the names or semantics of existing fields** without a strong reason documented in the PR/commit message.

### 1.1 API Specification Sources (two documents, potential conflicts)

There are two guide documents from the user that complement each other but **conflict in some places**:

- `Payment_Gateway_API_Communication_Guide__No_SDK_.md` (guide v1) — more detailed on signature/crypto schemes (RSA-SHA256, HMAC-SHA512, AES-CBC for Doku; legacy token-exchange for Midtrans).
- `Comprehensive_Payment_Gateway_API_Guide__No_SDK_.md` (guide v2) — newer, has explicit endpoint tables, examples for Midtrans Core API v2 (`/v2/charge`, Basic Auth), Xendit v3 (`/v3/payment_requests`, field `request_amount`, header `X-IDEMPOTENCY-KEY`), and Stripe 3DS redirect details.

**Reconciliation rules (mandatory, validated via web search against official vendor documentation as of July 16, 2026):**

| Conflict Topic                          | Decision                                                                                                                                                                                                                                                                                         | Reason                                                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Xendit endpoint & version               | Use **v3** (`POST /v3/payment_requests`, field `request_amount`, not `amount`) from guide v2                                                                                                                                                                                                     | Confirmed still current at `docs.xendit.co/apidocs/create-payment-request`                                                                                                               |
| Midtrans Auth                           | Implement the **classic Core API v2** (`/v2/charge`, Basic Auth using Server Key) from guide v2 as the primary target for the SDK's v1. The asymmetric token-exchange scheme from guide v1 (BI-SNAP based) is noted as a separate variant for a future phase (see "Extensibility")               | Guide v2 is simpler, covers a wider range of payment types, and is the more commonly used Midtrans product; SNAP-BI is a different product and should not be mixed into the same adapter |
| Doku status endpoint                    | Now explicit: `POST /service/v1/status` (from guide v2) — remove the previously unclear "TODO" status                                                                                                                                                                                            | Guide v2 provides explicit endpoint tables not present in guide v1                                                                                                                       |
| Doku signature/crypto & Stripe webhooks | Still follow the details from guide v1 (guide v2 does not detail algorithms)                                                                                                                                                                                                                     | Guide v2 doesn't cover this at all; this is not a conflict, both are used together                                                                                                       |
| Xendit status field                     | The actual Xendit v3 status union is `AUTHORIZED / CANCELED / SUCCEEDED / FAILED / EXPIRED / PENDING / REQUIRES_ACTION / ACCEPTING_PAYMENTS` (different casing from `PaymentResponse.status` universal) → an explicit mapping table is required in `mapper.ts`, do not assume they match exactly | Confirmed from `docs.xendit.co/apidocs/get-payment`                                                                                                                                      |

For other fields not mentioned in the table above: if both guide v1 and v2 discuss them and there is no conflict, combine them (union of information, not choosing one over the other).

## 2. Non-Negotiable Principles

1. **Zero vendor SDK dependency.** Must not `npm install stripe`, `midtrans-client`, `xendit-node`, etc. All requests must be made manually via `fetch` + custom signature/crypto utilities.
2. **Universal interface first.** SDK consumers should be able to write code once (`unipay.createPayment(req)`) and switch gateways by only changing configuration/provider, not the request shape.
3. **Runtime-agnostic.** Core code (`src/core`, `src/gateways`) must not use Bun-specific APIs (`Bun.*`) or Node-specific ones (`node:fs`, etc.) in the main runtime path. May use Web-standard APIs (`fetch`, `crypto.subtle`, `URLSearchParams`, `TextEncoder`) as they are available in Bun, Node ≥ 18, Deno, and edge runtimes (Workers/Vercel Edge).
4. **Package manager agnostic.** Primary development uses **Bun**, but the published package must install and run smoothly via `npm install`, `yarn add`, `pnpm add`. No `postinstall` script that requires Bun to be installed on the consumer's machine.
5. **Strict TypeScript.** `strict: true`, no implicit `any`. Explicit `any` is only allowed for `rawResponse`/`rawRequest` passthrough fields that genuinely cannot be typed (raw vendor payloads).
6. **No secrets logged.** API keys, secrets, signatures, access tokens must not be logged in full via `console.log`/logger (may mask partially if needed for debugging).
7. **Idempotency & context-aware retries.** Do not auto-retry on non-idempotent operations (create payment) without an explicit idempotency key from the gateway.
8. **Fail loud, fail typed.** All errors must go through the `UnipayError` hierarchy (see PLAN_SDK), not `throw new Error(string)`.

## 3. Tech Stack

| Area                      | Choice                                                                                                                                                               | Notes                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Language                  | TypeScript (strict)                                                                                                                                                  | target `ES2022`, module `NodeNext`                                          |
| Package manager (dev)     | Bun                                                                                                                                                                  | but avoid Bun-only APIs in `src/`                                           |
| Build/bundler             | `tsup`                                                                                                                                                               | dual ESM + CJS output + `.d.ts`, single entry + subpath per gateway         |
| HTTP                      | `fetch` global (Web standard)                                                                                                                                        | no axios/got/node-fetch as dependencies                                     |
| Crypto                    | `node:crypto` **only in adapters that need it** (RSA/HMAC signature for Doku/Midtrans) via conditional import, fallback `crypto.subtle` in Web runtime when possible | documented in PLAN_SDK signature phase                                      |
| Testing                   | `vitest`                                                                                                                                                             | runs on Bun & Node, easy for non-Bun contributors; HTTP mocking using `msw` |
| Lint/format               | `eslint` + `@typescript-eslint`, `prettier`                                                                                                                          | strict config, no-floating-promises enabled                                 |
| Runtime schema validation | `zod` (optional, small dependency)                                                                                                                                   | for validating gateway config during `initialize()`                         |

## 4. Repository Structure (final target)

```
unipay/
├── AGENT.md
├── .agents/plans/PLAN_SDK_1.md    # Bootstrap + Core infra
├── .agents/plans/PLAN_SDK_2.md    # Adapter: Stripe + Xendit
├── .agents/plans/PLAN_SDK_3.md    # Adapter: Midtrans + Doku
├── .agents/plans/PLAN_SDK_4.md    # Webhook dispatcher + Public API surface
├── .agents/plans/PLAN_SDK_5.md    # Build/packaging + Documentation
├── .agents/plans/PLAN_TEST_1.md   # Unit test core (parallel with PLAN_SDK_1)
├── .agents/plans/PLAN_TEST_2.md   # Contract + integration test Stripe & Xendit
├── .agents/plans/PLAN_TEST_3.md   # Contract + integration test Midtrans & Doku
├── .agents/plans/PLAN_TEST_4.md   # Webhook dispatcher test + type-level test
├── .agents/plans/PLAN_TEST_5.md   # CI, coverage, e2e sandbox optional
├── docs/
│   └── source-material/          # original reference documents from user (do not edit)
│       ├── payment_gateway_contracts.ts
│       ├── Payment_Gateway_API_Communication_Guide__No_SDK_.md
│       └── Comprehensive_Payment_Gateway_API_Guide__No_SDK_.md
├── src/
│   ├── core/
│   │   ├── types.ts              # universal request/response contracts (extends baseline)
│   │   ├── errors.ts             # UnipayError hierarchy
│   │   ├── http-client.ts        # fetch wrapper: timeout, retry policy, error mapping
│   │   ├── base-gateway.ts       # AbstractPaymentGateway (evolution from contracts.ts)
│   │   ├── signature/            # HMAC, RSA-SHA256, AES-CBC util per scheme
│   │   ├── config.ts             # zod schema config per gateway
│   │   └── registry.ts           # gateway factory/registry
│   ├── gateways/
│   │   ├── stripe/
│   │   ├── xendit/
│   │   ├── midtrans/
│   │   └── doku/
│   ├── webhooks/
│   │   └── verify.ts             # webhook signature verification dispatcher per gateway
│   └── index.ts                  # public entrypoint (UnipayClient)
├── tests/
│   ├── unit/
│   ├── contract/                 # 1 suite run against all adapters
│   ├── integration/              # mocked HTTP (msw) per gateway
│   └── fixtures/                 # sample requests/responses from guides
├── examples/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

## 5. Agent Workflow

1. Read `AGENT.md` (this document) → understand the constraints.
2. Work on the plan files **in sequential order**, and each `PLAN_SDK_n.md` is paired with `PLAN_TEST_n.md` which must be worked on simultaneously (TDD) — not stacked at the end:
   - `PLAN_SDK_1.md` + `PLAN_TEST_1.md` — Bootstrap & Core infra (blocking, all other phases depend on this)
   - `PLAN_SDK_2.md` + `PLAN_TEST_2.md` — Stripe & Xendit adapters
   - `PLAN_SDK_3.md` + `PLAN_TEST_3.md` — Midtrans & Doku adapters
   - `PLAN_SDK_4.md` + `PLAN_TEST_4.md` — Webhook dispatcher & Public API surface
   - `PLAN_SDK_5.md` + `PLAN_TEST_5.md` — Build/packaging & Documentation
     Phases 2 and 3 may be worked on in parallel by different agents/sessions as they do not depend on each other (both only depend on Phase 1) — but Phase 4 must wait for Phases 2 **and** 3 to be complete.
3. Upon completing a task in a `PLAN_SDK_n.md`, cross-check the related test task in the corresponding `PLAN_TEST_n.md` — ideally **TDD**: write/adapt tests first, then implement, at minimum for signature/crypto functions and request-response mapping that are prone to errors.
4. Mark checkboxes (`- [x]`) in the plan file once the task is complete **and** related tests are green. Do not mark complete if it only "seems to work".
5. Commit granularly per task/sub-phase, commit message format: `feat(core): add http-client with timeout+retry`, `feat(gateway-stripe): implement createPayment`, `test(gateway-doku): signature RSA-SHA256`.
6. If encountering ambiguity in source documents (e.g., incomplete fields in the API guide), make the most reasonable assumption, document it in code comments and PR notes, do not stall waiting for clarification unless it's truly blocking.
7. Definition of Done per phase: `bun run typecheck`, `bun run lint`, `bun run test` all green; build (`bun run build`) produces ESM+CJS+types output without errors; no vendor SDK dependencies sneak into `package.json`.

## 6. Code Conventions

- All gateway adapters **extend** `AbstractPaymentGateway` and **implement** `IPaymentGateway` — no additional public methods outside the interface for core operations (private/protected methods as needed are fine).
- Adapter file names: `src/gateways/<vendor>/index.ts`, `src/gateways/<vendor>/mapper.ts` (request/response mapping), `src/gateways/<vendor>/signature.ts` (if applicable), `src/gateways/<vendor>/types.ts` (raw vendor payload types, not exported to consumers).
- Consumers never see internal vendor types — only universal types from `core/types.ts`.
- **No hardcoded base URLs.** Each gateway must define a single `BASE_URL` constant in `src/gateways/<vendor>/index.ts` and reference it for all API calls. Hardcoding `https://api.stripe.com/v1/...` across multiple methods creates a maintenance hazard — changing the base URL requires editing every location.
- Vendor errors (HTTP 4xx/5xx or error responses) are mapped to `UnipayError` with `code`, `gatewayCode` (original vendor code), `gateway` (vendor name), `raw`.
- All public async functions return `Promise<T>` that rejects with `UnipayError`, never reject with plain strings/objects.

## 7. Security

- Gateway config (`apiKey`, `secretKey`, `clientId`, `privateKey`, etc.) is only stored in memory instance, never written to disk/log by the library.
- Signature generation (RSA-SHA256, HMAC-SHA512, AES-CBC) is implemented according to each vendor's scheme in the guides, tested with test vectors to avoid encoding errors (hex vs base64, concatenation order, etc.).
- Webhook verification must reject payloads with invalid signatures — default is **deny**, not **allow** when verification fails/throws an exception.

## 8. What the agent will NOT do in this phase

- No UI/dashboard creation.
- No gateways beyond the 4 defined in the guides unless explicitly requested (but architecture should still be designed to easily add a 5th gateway — see "Extensibility" in PLAN_SDK).
- No live calls to vendor sandbox by default in automated tests (only optional, gated by env var, see PLAN_TEST).
