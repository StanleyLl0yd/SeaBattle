-- Dedicated SeaBattle rooms. Client roles cannot read any room rows.
-- All participant authorization and fleet redaction happen in the Edge Function.
create table if not exists public.seabattle_rooms (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{12}$'),
  host_token_hash text not null check (length(host_token_hash) = 64),
  guest_token_hash text check (guest_token_hash is null or length(guest_token_hash) = 64),
  host_name text not null check (char_length(host_name) between 1 and 24),
  guest_name text check (guest_name is null or char_length(guest_name) between 1 and 24),
  host_fleet jsonb,
  guest_fleet jsonb,
  host_shots jsonb not null default '[]'::jsonb,
  guest_shots jsonb not null default '[]'::jsonb,
  host_ready boolean not null default false,
  guest_ready boolean not null default false,
  host_seen timestamptz not null,
  guest_seen timestamptz,
  host_rematch boolean not null default false,
  guest_rematch boolean not null default false,
  phase text not null check (phase in ('waiting','placement','playing','finished')),
  round integer not null default 1 check (round between 1 and 100),
  turn text check (turn is null or turn in ('host','guest')),
  winner text check (winner is null or winner in ('host','guest')),
  finish_reason text check (finish_reason is null or finish_reason in ('sunk','surrender','left','disconnect')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  expires_at timestamptz not null,
  version integer not null default 1 check (version > 0),
  constraint seabattle_room_expiry check (expires_at > created_at)
);
create index if not exists seabattle_rooms_expires_idx on public.seabattle_rooms (expires_at);
alter table public.seabattle_rooms enable row level security;
revoke all on table public.seabattle_rooms from public, anon, authenticated;
grant select,insert,update,delete on table public.seabattle_rooms to service_role;
-- No anon/authenticated RLS policies: direct PostgREST access must fail closed.
-- The Edge Function deletes expired rooms on create; also schedule regular
-- DELETE FROM public.seabattle_rooms WHERE expires_at < now() using a trusted
-- scheduled job to bound storage even during inactivity.
