# SeaBattle multiplayer backend (1.3.0, draft)

The online two-player system is **independent** of offline single-player SeaBattle.
Two players participate synchronously and exchange moves through an authoritative
server, with no account, asynchronous correspondence, chat or public matchmaking.

## Dedicated test backend — DEPLOYED (not publicly released)

- Supabase organization: **Silver Lightning**, Free plan.
- SeaBattle project: `qxmbxqfiotogncnwcdvq` in Frankfurt (`eu-central-1`).
- Supabase quoted creation cost: **$0/month**; this is the second active
  free project in the organization. No paid upgrade or add-ons requested.
- `public.seabattle_rooms`: RLS on, no direct anon/authenticated privileges
  or policies. Elevated credentials remain exclusively in Edge Functions.
- Migrations applied: room schema, hourly expiration cron, 120-room/hour
  and 500-unexpired-room atomic creation guard. The cron job is active;
  periodic execution needs operational observation.
- `seabattle-multiplayer` Edge Function **v2 ACTIVE**, `verify_jwt=false`;
  member-specific room-token authorization is enforced in the function.
- Live API smoke and two independent browser-controller contexts passed
  against this project in GitHub Actions; results linked in PR #34.
- **Public player UI remains disabled**: `ONLINE_API` is blank on draft;
  published 1.2.1 remains offline-capable and unchanged.

The Free tier can pause projects after insufficient activity, and feature
quotas apply. An outage or a paused free project must not affect solo play.
Do not enable paid services without explicit approval.

### Reproduce the isolated deployment

1. Create a dedicated Supabase project in the explicitly authorized organization.
   Never use FootballForecast's database or project credentials.
2. Apply migration files in `supabase/migrations/` in order.
3. Verify no anonymous table grants/policies, RLS, cron and capacity trigger.
4. Deploy `supabase/functions/seabattle-multiplayer/`, entrypoint `index.mjs`,
   with `verify_jwt=false` as specified in `supabase/config.toml`.
5. The server reads `SUPABASE_URL` and `SUPABASE_SECRET_KEYS.default` from
   secure runtime environment. Never commit or send elevated keys to clients.
6. After final approval, configure the **public URL only** in
   `js/multiplayer-config.js`. Then bump version/cache/release metadata,
   verify all suites, and deploy through protected main.

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

The dedicated test backend is deployed; the public browser UI is not.
Existing v1.2.1 remains the supported production release.

## Free-tier resource guard

A database trigger atomically caps creation at **120 rooms per rolling hour** and
**500 concurrent unexpired rooms**, irrespective of API caller. The Edge API
returns HTTP 429 / ROOM_RATE_LIMIT when the cap is reached. This is a bounded
project-level backstop rather than robust per-user abuse prevention; a deliberate
attacker can still exhaust the shared creation quota. The server endpoint needs
an edge/WAF-level rate limiter or authenticated access if exposed broadly.
No IP addresses or persistent visitor identifiers are added by this safeguard.
