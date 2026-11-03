-- Expire rooms after 24 hours even when no new matches are created.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'seabattle-clean-expired-rooms',
  '0 * * * *',
  $$delete from public.seabattle_rooms where expires_at <= now()$$
);
