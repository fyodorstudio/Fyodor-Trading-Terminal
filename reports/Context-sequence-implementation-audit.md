# Clickable context roofs / organized Raycaster — 7 October 2026

The accepted roof UI is implemented. The standalone interpreters and accumulated
USD context arithmetic are unchanged. This pass also exposes a bounded seven-day
fresh-news experiment alongside accumulated memory, always labeled Weak evidence.

## Review workflow

1. Show Raycaster and open its gear. Inputs control calculation; Inspector filters
   and its date range control which event markers/roofs are visible.
2. Click a roof above those markers. **Combo details** opens in the bottom Inspector.
3. Review the original publication times, standalone biases, roles/change effects,
   qualifying conditions, before/after context and source contributions.
4. Click a participating publication to open its original readings. ISM remains
   grouped with separate sector sections. Return to releases exits Combo details.
5. Record release interpretation, combined context and H1 price reaction separately.
   Reopen the roof after changing scoring settings; an open snapshot is captured.

## Exposed relationships

- Existing monthly ISM sector resolution.
- Existing guarded labor/inflation priority.
- Existing three-report Claims challenge against older weak/incomplete NFP.
- Experimental fresh-news agreement across at least two economic domains.

The gear now separates accumulated result, input table, relationship conditions,
fresh-news comparison, chart controls and calculation/evidence notes. No hidden
collapsible rule panels or separate scoring filter was added. The USD snapshot
is explicitly distinguished from the optional EUR/USD relative view.

## Dataset checks

Replay: stored `Elev8-Demo2` USD inventory, revision 78432, selected through
7 October 2026, all eight default families, automatic magnitude boundaries.

- All **5,696 accumulated context points** exactly match the committed prior
  timeline builder, including directions, evidence, contributions and update text.
  Only the version and relationship metadata are added.
- SHA-256 of preserved points:
  `cf8029e70d31f5bb0232dcf2d04cb0a6e080c0ee0159584a6c18350b70406111`.
- Through the latest stored publication: **1,120 dated roof snapshots** — 113 ISM,
  11 labor/inflation, 27 weekly-labor and 969 experimental fresh-news updates.
  These counts include overlapping updates; they are not independent trials.
- All **3,571 publication endpoints** are no later than their roof's known-by clock.
- Six future-removal prefix checks pass at actual eligible roof clocks:
  7 February, 3 March, 5 March, 12 August and 24 December 2025; 17 June 2026.
  The requested February 27/December 31 scan dates had no new roof on those days,
  so the audit used the last eligible publication snapshot before each date.

Saved artifacts: `storage/data/combo-sequence-audit.json` and its log (ignored
local files). Reproduce with:

```powershell
pnpm --dir frontend exec node scripts/usd-context/audit-sequences.mjs '../storage/data/usd-menu-v5-design-snapshot.json' '../storage/data/combo-sequence-audit.json' 2026-10-07
```

The reference builder is exclusively created as a temporary exact file from Git
HEAD and removed after the audit; the shared working tree is not reset.

## February–March example

The first qualified fresh-news roof appears **3 March 2025, 17:00 broker time**,
with Weak Long fresh support while accumulated context remains Weak Short. March
5 shows the separate completed ISM-sector roof and another fresh-news snapshot.
March 7 NFP leaves both fresh and accumulated results Weak Long. The unchanged
GDP revision adds zero; opposing PCE remains visible. March 6 Claims is still
standalone Long but is less negative than its predecessor, so its replacement
change increases USD support. There is no invented confirmation vote.

The earlier price audit found much of the March 3 rally occurred **before** ISM.
This new view does not attribute that earlier movement to a later publication.
Neither main context nor the experiment is forced to match the candles.

## Verification and remaining scope

New terminal suites cover source replacement versus standalone direction, fixed
base weights, exact expiry, atomic same-time data, non-voting missing GDP,
domain overlap, Claims confirmations, pending/future ISM sectors, disabled inputs,
future-removal chronology, geometry, overflow, source links, flat gear structure,
saved settings and workspace restoration. **All 43 sequential suites, lint and
the TypeScript/production build pass.** Vite SSR suites remained sequential to
avoid dependency-cache contention. No visual UI audit was performed.

Manual UI audit remains with the user: roof placement while panning/zooming;
crowded roofs; hidden markers; Inspector source navigation; short dock heights;
gear readability and normal drawing interactions.

The six broader research tracks have not all been implemented. PCE demand companions,
broader cross-family regime refinements and a separate fixed-window price audit
remain deferred. No roof claims historically proven volatility. Dataset revisions,
missing coverage and coarse candle timing remain visible limitations.
