create table if not exists public.vc_app_store (
  id text primary key check (id = 'main'),
  revision bigint not null default 0,
  store jsonb not null check (jsonb_typeof(store) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.vc_app_store enable row level security;
revoke all on public.vc_app_store from anon, authenticated;
grant select, insert, update on public.vc_app_store to service_role;