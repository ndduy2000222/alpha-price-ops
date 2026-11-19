# Worker boundary

The production worker belongs outside the browser and should own scheduling, Shopee API reads/writes, idempotency keys, lock acquisition, retry policy, and reconciliation. The current MVP only ships the pure pricing engine and a mock adapter in the UI; it deliberately does not claim that the Shopee integration is complete.

Recommended next implementation: a Node.js/TypeScript worker backed by PostgreSQL/Supabase, with one job per shop/SKU and a lock on `(shop_id, sku_id)`. Before the first real write, the worker must read current promotion state, display a review diff, require explicit approval, write once, then read back the applied state.
