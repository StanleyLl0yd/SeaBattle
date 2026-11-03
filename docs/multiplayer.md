# SeaBattle multiplayer backend (1.3.0, draft)

The online two-player system is **independent** of offline single-player SeaBattle.
Two players participate synchronously and exchange moves through an authoritative
server, with no account, asynchronous correspondence, chat or public matchmaking.

## Separate project required

Create a **new, dedicated Supabase project** in an organization explicitly selected
by the owner; obtain cost approval when applicable. Do not deploy into the existing
FootballForecast production project, even for testing.

1. Apply the initial room-table SQL migration in supabase/migrations in order.
   It enables RLS, revokes all client roles, and grants room access to service_role.
2. Apply the second migration for an hourly pg_cron cleanup of expired rooms.
   Confirm the scheduler exists and has completed at least one run.
3. Deploy the Edge Function directory supabase/functions/seabattle-multiplayer/
   using entrypoint index.mjs with verify_jwt=false from supabase/config.toml.
   The Edge runtime provides SUPABASE_URL and SUPABASE_SECRET_KEYS.default;
   the legacy SUPABASE_SERVICE_ROLE_KEY is accepted only for compatibility.
4. **Never commit either secret** or use it in browser requests. The backend alone
   calls PostgREST with the elevated key. Browser calls require only a room token.
5. After successful two-device acceptance, set the browser-public ONLINE_API URL
   in js/multiplayer-config.js to the deployed HTTPS Edge Function URL, using
   the format https://PROJECTREF.supabase.co/functions/v1/seabattle-multiplayer .
   Leave the URL blank before backend acceptance, which hides the online button.
6. Bump the release version, cache key and release automation **only** when
   all launch checks pass. PR #34 must stay Draft until then.

## Protocol and security

All operations use POST JSON. Create a room with an optional nickname and receive
a 12-character invitation code and a 48-character secret participant token.
The inviter shares **only the code or URL**. The invited player joins with the
code and receives an independent secret token. Two participants maximum.

Authenticated room actions: state, ready, fire, surrender, leave, claim, rematch.
Only hashed participant tokens are stored on the server. The browser stores
only its own code/token pair as seabattle.online.session.v1 to enable reconnect.
No unsunk enemy fleet, local shot trace or player profile is persisted.

All hidden ship positions, hit/miss resolution, no-touching fleet rules,
turn order, blocked cells, victory and rematch eligibility are validated on
the server. JSON views are redacted per participant; opposing unsunk ship
positions are never returned. Updates use optimistic version compare to reject
racing writes, including concurrent shots and simultaneous joins.

The UI polls every **1.5 seconds** while visible and every 5 seconds in the
background. This is near-real-time, not a WebSocket transport; load and cost
testing is required before general availability. A participant is treated
offline after 12 seconds without a heartbeat; new shots are blocked after
15 seconds. The remaining participant can claim victory after a 120-second
reconnect window. Matches expire after 24 hours. Both participants must
agree to a rematch.

## Mandatory launch acceptance

- [ ] Isolated Supabase project explicitly approved; cost limits confirmed
- [ ] Backend migration and hourly cleanup deployed and verified
- [ ] RLS enabled; direct anon/authenticated table access denied
- [ ] Service secret never exposed in PWA, frontend or API response
- [ ] Wrong room code and token rejected; a third player cannot join
- [ ] Competing joins choose exactly one guest; two concurrent shots cannot both win
- [ ] Invalid, repeat, adjacent-to-sunk, out-of-turn shots rejected
- [ ] No hidden enemy fleet cells leak in response, status or errors
- [ ] Two actual devices and networks: invite, join, ready, fire, win
- [ ] Disconnect, reconnect before 120 s, claim after 120 s, surrender and rematch
- [ ] Both language modes and narrow mobile layout tested
- [ ] Abuse protection, operational rate limiting and project quotas addressed
- [ ] Existing single-player, careers, Daily, offline PWA and saves unchanged
- [ ] Exact-head CI success, protected squash, exact-main CI and Pages deployment
- [ ] Manual end-to-end acceptance before release 1.3.0

Possession of an unused invitation code allows joining before the intended
friend; possession of a participant's token allows impersonation. This is
private invitation play, not an identity-verification service.

No database schema changes have been deployed from this draft. Existing
v1.2.1 remains the supported production release.

## Free-tier resource guard

A database trigger atomically caps creation at **120 rooms per rolling hour** and
**500 concurrent unexpired rooms**, irrespective of API caller. The Edge API
returns HTTP 429 / ROOM_RATE_LIMIT when the cap is reached. This is a bounded
project-level backstop rather than robust per-user abuse prevention; a deliberate
attacker can still exhaust the shared creation quota. The server endpoint needs
an edge/WAF-level rate limiter or authenticated access if exposed broadly.
No IP addresses or persistent visitor identifiers are added by this safeguard.
