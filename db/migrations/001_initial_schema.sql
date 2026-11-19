create extension if not exists pgcrypto;

create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'shopee',
  external_shop_id text not null,
  name text not null,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  currency char(3) not null default 'VND',
  status text not null default 'active' check (status in ('active', 'paused', 'disconnected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, external_shop_id)
);

create table if not exists shop_connections (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  provider text not null,
  external_account_id text,
  status text not null default 'pending' check (status in ('pending', 'connected', 'expired', 'revoked', 'error')),
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, provider)
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  external_item_id text not null,
  title text not null,
  status text not null default 'active',
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, external_item_id)
);

create table if not exists product_models (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  external_model_id text not null,
  sku text,
  title text not null,
  current_price integer not null check (current_price >= 0),
  promotion_price integer check (promotion_price is null or promotion_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  status text not null default 'active',
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, external_model_id)
);

create table if not exists price_snapshots (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  model_id uuid not null references product_models(id) on delete cascade,
  listing_price integer not null check (listing_price >= 0),
  promotion_price integer check (promotion_price is null or promotion_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  source text not null,
  observed_at timestamptz not null,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists price_snapshots_model_observed_idx on price_snapshots(model_id, observed_at desc);

create table if not exists competitors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text not null default 'shopee',
  external_shop_id text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (platform, external_shop_id)
);

create table if not exists competitor_links (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  model_id uuid not null references product_models(id) on delete cascade,
  competitor_id uuid not null references competitors(id) on delete cascade,
  external_item_id text not null,
  external_model_id text,
  variant_name text,
  confidence text not null default 'manual' check (confidence in ('manual', 'verified', 'uncertain')),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (model_id, competitor_id, external_item_id, external_model_id)
);

create table if not exists competitor_observations (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references competitor_links(id) on delete cascade,
  observed_price integer not null check (observed_price > 0),
  in_stock boolean not null,
  valid boolean not null default true,
  source text not null,
  observed_at timestamptz not null,
  raw_reference text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists competitor_observations_link_observed_idx on competitor_observations(link_id, observed_at desc);

create table if not exists pricing_rules (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  model_id uuid not null references product_models(id) on delete cascade,
  version integer not null default 1,
  kind text not null check (kind in ('amount', 'percent')),
  value integer not null check (value >= 0),
  floor_price integer not null check (floor_price >= 0),
  ceiling_price integer not null check (ceiling_price >= floor_price),
  allow_increase boolean not null default false,
  cooldown_hours integer not null default 0 check (cooldown_hours >= 0),
  max_drop_percent integer not null default 20 check (max_drop_percent >= 0 and max_drop_percent <= 100),
  active boolean not null default true,
  effective_from timestamptz not null default now(),
  created_by text,
  created_at timestamptz not null default now()
);

create unique index if not exists pricing_rules_active_model_idx on pricing_rules(model_id) where active = true;

create table if not exists price_recommendations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  model_id uuid not null references product_models(id) on delete cascade,
  rule_id uuid references pricing_rules(id),
  status text not null default 'suggested' check (status in ('suggested', 'needs_review', 'approved', 'rejected', 'expired', 'blocked', 'executed')),
  current_price integer not null check (current_price >= 0),
  reference_price integer check (reference_price is null or reference_price >= 0),
  proposed_price integer check (proposed_price is null or proposed_price >= 0),
  reason text not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  rule_snapshot jsonb not null default '{}'::jsonb,
  engine_version text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recommendations_shop_status_idx on price_recommendations(shop_id, status, created_at desc);

create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references price_recommendations(id) on delete cascade,
  reviewer_id text not null,
  decision text not null check (decision in ('approved', 'rejected')),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists execution_attempts (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references price_recommendations(id) on delete cascade,
  idempotency_key text not null unique,
  mode text not null check (mode in ('dry_run', 'production')),
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'needs_reconciliation', 'cancelled')),
  request_payload jsonb,
  response_payload jsonb,
  attempt_count integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id) on delete set null,
  actor_id text,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_state jsonb,
  after_state jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_shop_created_idx on audit_events(shop_id, created_at desc);

create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  provider text not null,
  sync_kind text not null,
  status text not null check (status in ('queued', 'running', 'succeeded', 'partial', 'failed')),
  records_seen integer not null default 0,
  records_upserted integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
