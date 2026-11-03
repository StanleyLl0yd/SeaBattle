-- Server-side global capacity backstop for the free plan; no IP or user tracking.
-- Atomic across concurrent Edge Function instances.
create or replace function public.seabattle_room_creation_limit()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  perform pg_advisory_xact_lock(1093825491);
  if (
    (select count(*) from public.seabattle_rooms where created_at > now() - interval '1 hour') >= 120
    or
    (select count(*) from public.seabattle_rooms where expires_at > now()) >= 500
  ) then
    raise exception using errcode = 'P0001', message = 'ROOM_RATE_LIMIT';
  end if;
  return new;
end;
$$;
revoke all on function public.seabattle_room_creation_limit() from public, anon, authenticated;
drop trigger if exists seabattle_room_creation_limit_trigger on public.seabattle_rooms;
create trigger seabattle_room_creation_limit_trigger
before insert on public.seabattle_rooms
for each row execute function public.seabattle_room_creation_limit();
