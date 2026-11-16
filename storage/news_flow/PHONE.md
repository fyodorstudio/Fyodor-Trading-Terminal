# Android News Flow

Run `pnpm run dev:all` from the repository root. This still starts the bridge,
storage and frontend, and now builds the separate phone reader and restarts the
private local phone service. No Docker, paid API or public ntfy account is needed.

## Connect once

1. Install **ntfy** from Google Play. Connect the phone to the PC's home router.
2. On the desktop open **News Flow -> bell** (immediately right of Search).
3. Under Android notifications, copy the displayed **Server** and **Topic** into
   a new ntfy subscription. Select your own server, not the default ntfy.sh.
4. Use **Show reader login** for username `reader` and the generated password.
   Add this user for that server in ntfy if the app requests authentication.
5. Allow Android notifications; keep ntfy **Instant delivery** enabled. If Android
   restricts its background connection, allow the app's background/battery access.
6. Choose **Included keywords** or **All new headlines** for Phone trigger, then
   press **Send test notification**. Confirm receipt on the actual phone.
7. Open **Phone news page** in your phone browser. Use the same reader login.
   Bookmark it or add a home-screen shortcut. Notification taps open the publisher
   link directly. Reading the full feed happens on the separate phone news page.

Phone delivery and desktop sound have separate on/off modes. Phone alerts use the
desktop Include/Exclude and provider visibility last synchronized by the workspace.
They keep running after the browser closes while storage and the PC remain awake.
The reader shares those keyword rules (refreshes every 30 seconds), but its own
provider selections, search, date and classification tab do not change PC alerts.
It contains no trading settings, Wildcard writes or provider editing. Phone dates
use the phone timezone and query collected items only; use desktop historical
research to fetch older material. Copy includes all matching collected pages.

## Local network and startup

- ntfy listens on **8004**; the authenticated read-only phone gateway uses **8005**.
  MT5, storage and the desktop Vite server keep their existing loopback listeners.
- The startup script adds/updates one Windows inbound rule for these two TCP ports,
  restricted to the routed interface, its current local address and `LocalSubnet`.
  It does not disable the firewall, change the network profile or forward router ports.
  If Windows denies rule creation, run `pnpm news:phone` once as Administrator.
- `pnpm news:phone` builds/reuses the service; `pnpm news:phone:restart` rebuilds and
  reloads it. Restart validates process executable, module/config and checkout
  before stopping a listener. Unrelated owners of 8004/8005 are left untouched.
- First setup downloads official **ntfy 2.38.0 Windows amd64**, pinned to archive
  SHA-256 `3e8b0ee3cde66c37586e53f0dd192647c13c6f329226ac3f22b63445961e29fb`.
  Later starts use the local binary. No third-party executable is committed.
- Binary, bcrypt-provisioned users, generated credentials, one-hour ntfy cache,
  alert profile and logs live under `<storage-data>/news-flow/phone/` (Git ignored).
  Credentials never appear in launch arguments or startup output. The topic is
  private: anonymous access denied, publisher write-only, reader read-only.
- This initial setup uses HTTP on trusted home LAN. It is not an internet-facing
  deployment. Both phone subscriptions and the reader require the home network;
  away-from-home access would require a separate private access arrangement.
- Guest Wi-Fi/client isolation may prevent devices on one router from connecting.
  If the PC's LAN address changes, restart dev:all and update the phone server URL.
  A router DHCP reservation can keep that address stable.

## Delivery semantics

New live collection from a primed source creates a monotonic arrival. Publication
may be much earlier. Backfill, first-source loads, updates and known URLs do not
create alerts. Service/listener startup establishes a silent baseline. Enabling
phone alerts does not replay items collected while off. Rule edits keep the cursor.

The backend polls arrivals every 0.5 seconds and coalesces a batch into one ntfy
notification (up to ten headline/link previews, count retained). Failed publishing
keeps the cursor and retries after five seconds; arrivals older than 15 minutes
are not replayed. A request acknowledged by ntfy is **sent**, not confirmed receipt
on the handset. A network timeout after acceptance can result in a duplicate retry.
Android notification channels, battery restrictions, offline state and DND affect
handset presentation; test with the phone locked as well as awake.

Desktop alerts also follow collection, independent of publication timestamp. A
blocked audio batch remains visible and can play one coalesced tone after a user
gesture within one minute; older blocked sounds are not replayed. The last alert
retains the matching links, collection time and raw feed publication time.

The collector schedules at most eight active requests, two per host, oldest due
first; it does not enqueue the entire provider pack behind slow responses. The
one-second default remains a minimum delay after completion, subject to capacity
and HTTP backoff. Provider settings expose request duration and lateness after due.
These are local measurements, not proof of the time a feed first exposed an item.
Publisher RSS and Google discovery delays remain outside the terminal's control.

The v5 provider pack has 52 active starter subscriptions. Phone logins and
ntfy subscriptions do not need changing. Delayed articles show both publication
and collection times; PC provider settings expose the bounded fetch diagnostics.


## Trading relevance

Reader colours, desktop sounds and phone notifications use the same backend
classification. Trading relevance defaults on and protects official policy and
economic releases while requiring context for broad words. Explicit Exclude wins.
The one-time preset revision 3 migration preserves custom terms, exclusions,
selected providers and Off. Enabled old All profiles switch to Included; users
can explicitly choose All again afterward. Local backups retain prior settings.
No ntfy subscription or login changes are required. See [RELEVANCE.md](RELEVANCE.md).
