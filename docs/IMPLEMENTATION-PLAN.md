# Alpha Price Ops — Production Foundation Plan

## Current baseline

- Next.js + TypeScript dashboard with deterministic pricing engine.
- Demo adapter is the default; no Shopee production write path exists.
- Production deployment is protected by the existing Git-linked Vercel project.

## Safe delivery order

1. PostgreSQL schema and migrations.
2. Server-side database adapter with demo fallback.
3. Persisted SKU, observation, recommendation, approval and audit flows.
4. Authentication and shop-scoped authorization.
5. Shopee read-only adapter and incremental sync.
6. KPI queries and reconciliation views.
7. Dry-run execution with idempotency and kill switch.
8. One-SKU production pilot only after an explicit approval gate.

## Non-goals until the pilot gate

- No production Shopee price write.
- No Auto mode.
- No secrets in source control or browser code.
- No paid infrastructure provisioning without an explicit user decision.

## Runtime modes

- `demo`: uses the existing mock adapter and is safe for presentations.
- `database`: uses `DATABASE_URL` on the server; the browser never receives database credentials.

## Database selection

The application uses a standard PostgreSQL connection string so it can run on Supabase, Neon, or another managed PostgreSQL provider without changing domain logic. A provider-specific integration can be added after credentials and environment scope are confirmed.
