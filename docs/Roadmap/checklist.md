# Fyodor Trading Terminal Checklist

**Last Updated:** 2026-04-16

This file is the grounded progress checklist and audit ledger.

Use this file for:

- what already exists and was cross-checked
- what is currently in progress
- what is not started yet
- what is blocked, unclear, or needs manual audit / product decision
- the practical implementation shape of the repo right now
- the honest notes that help de-slopify future work

Do not use this file as the stable product constitution or wording authority.

`docs/Roadmap/PRODUCT_CONTRACT.md` is the stable product authority.

`docs/Roadmap/terminology.md` is the naming, wording, and state-language authority.

## Legend

- `[x]` Done / exists and was cross-checked in code
- `[-]` In progress / partially implemented or still being actively refined
- `[ ]` Not started / not present yet
- `[?]` Blocked, needs decision, or requires manual audit beyond code inspection

## Audit Basis For This Pass

- [x] read the prior roadmap docs and merged their stable content into `docs/Roadmap/PRODUCT_CONTRACT.md`
- [x] cross-checked the app shell, tabs, shared bridge client, and bridge server
- [x] ran `pnpm test` successfully: 10 test files, 75 tests passed
- [x] ran `pnpm build` successfully
- [x] ran the bridge Python test suite successfully: 11 tests passed
- [x] checked the live running bridge at `http://127.0.0.1:8001`
- [x] checked coherence of the root `README.md`, `Main/README.md`, and `Main/mt5-bridge/README.md`

## Repo And Runtime Foundation

- [x] root workspace scripts exist for `dev:app`, `dev:bridge`, `dev:mt5`, `dev:all`, `build`, and `test`
- [x] frontend app exists in `Main`
- [x] vendored bridge exists in `Main/mt5-bridge`
- [x] broker symbol export exists in `docs/Reference/MT5_BROKER_SYMBOLS.md`
- [x] frontend build is currently passing
- [x] frontend test suite is currently passing
- [x] bridge test suite is currently passing
- [?] production frontend bundle is currently very large and triggers Vite chunk-size warnings; this needs a later performance/code-splitting audit

The repo is already functioning as one practical workspace: root scripts orchestrate MT5 launch, bridge startup, and frontend startup, while the actual application logic lives almost entirely under `Main` and `Main/mt5-bridge`. That foundation is materially better than a fake-monorepo layout where the root only pretends to be the source of truth.

The main structural weakness here is hygiene rather than absence. The repo is clearly using `pnpm` as the real workspace authority, but `Main/package-lock.json` still exists, which is a classic multi-agent drift artifact. That does not break the app immediately, but it does increase the chance of future dependency confusion, accidental npm installs, and misleading diffs.

The bridge side is now also verified rather than assumed. The local venv exists, `pytest` passes inside `Main/mt5-bridge`, and the live bridge is currently reporting MT5-connected health with populated calendar rows. That materially raises confidence in the repo's real runtime path, not just its frontend-facing shell.

## Frontend Shell And Navigation

- [x] connection-first header exists with collapsed and expanded operational states
- [x] tab navigation exists for `Overview`, `Central Banks Data`, `Charts`, `Economic Calendar`, and `Specialist Tools`
- [x] `Specialist Tools` currently contains `Differential Calculator`, `Strength Meter`, `Event Quality`, and `Event Reaction Engine`
- [x] left utility panel exists and persists font/palette preferences
- [-] visual unification is underway, but the app still mixes multiple UI languages across tabs
- [?] manual audit whether the app still feels like one compact command tool instead of multiple stitched-together surfaces

At the shell level, the app has a real product spine now. `App.tsx` is not a placeholder router anymore; it coordinates health, feed events, market-status polling, symbol context, navigation intent, theme controls, and the top-level tab model in a way that matches the product brief's connection-first intent.

Where the slop still shows is coherence across surfaces. The navigation structure is sensible, but the rendering language shifts noticeably between tabs: some feel like a disciplined terminal/control surface, while others feel like isolated design experiments. This is not a missing-feature problem; it is a consistency-and-ownership problem.

## Overview Mission Control

- [x] `Overview` is implemented as a live surface, not a placeholder
- [x] trust-state and pair-attention surfaces exist
- [x] `Macro Backdrop Verdict` exists
- [x] `Overview Confidence` exists with weighted breakdown and inspector
- [x] searchable pair selector exists with favorites and sorting
- [x] event radar exists with relevance tagging, urgency visibility, and deep-linking into calendar
- [x] `Who Is Winning Now` exists
- [x] `Best Pairs Right Now` exists
- [x] ATR and price-confirmation context reuse D1/H1 candle loads
- [x] Overview can navigate into deeper tabs through action shortcuts
- [-] final `Overview` stabilization decision is still open
- [?] manual audit whether the selected-pair hero remains clearly primary after the newer supporting blocks
- [?] manual audit whether `Overview Confidence` improves trust instead of feeling decorative
- [?] manual audit whether the app now answers `which side is winning, why, can I trust it, and what event risk matters` fast enough in real use

`Overview` is the clearest sign that the repo has moved beyond placeholder AI scaffolding. It has real domain intent: trust state, pair attention, macro verdict, event sensitivity, pair selection, and drill-down actions are all wired together around the selected symbol instead of being loosely adjacent cards with vague labels.

The main de-slop concern is not whether `Overview` exists, but whether too much intelligence is being packed into one very large tab file. `OverviewTab.tsx` now carries significant data-loading, derivation, persistence, orchestration, and presentation responsibility. The feature is real and useful, but it is also approaching the point where future edits become riskier because the file is doing too many jobs at once.

The product question here is no longer "build Overview." It is "stop Overview from turning into the everything-surface." The next manual audit should focus on hierarchy, honesty, and restraint, not on adding more blocks because the file can technically hold them.

## Charts

- [x] `Charts` tab exists with `lightweight-charts` integration
- [x] grouped symbol browsing, search, and favorites exist
- [x] timeframe switching exists from `M1` through `MN1`
- [x] historical candle loading exists
- [x] WebSocket live stream exists
- [x] market-session context exists
- [x] last-known-candle behavior and explicit no-data / error overlays exist instead of fake chart output
- [x] debug log panel exists
- [?] no dedicated `Charts` test file exists in the current frontend suite, so manual regression checks still matter here

The `Charts` surface is coherent in intent. It behaves like an execution-context tool instead of pretending to be an analysis oracle, and it does the right thing when data is missing: it preserves the last known state or says there is no data rather than inventing candles. That is exactly the sort of anti-slop honesty this repo should keep.

The largest remaining weakness is verification depth. The chart tab is clearly live and non-trivial, but it is underrepresented in automated tests compared with the pure derivation logic elsewhere in the app. That means the code is more trustworthy than a random AI mockup, but still more fragile than the more heavily tested overview and macro derivation utilities.

## Economic Calendar

- [x] MT5-backed calendar fetch exists
- [x] calendar supports today, this-week, and custom ranges
- [x] impact filtering, country filtering, and search exist
- [x] MT5 time plus viewer local/UTC modes exist
- [x] live, stale, loading, no-data, and error states exist
- [x] Overview event clicks can open the calendar on the correct range and target event
- [x] event highlight + scroll-to-target behavior exists
- [x] click-open event explainer panel exists
- [x] multi-country selection remains usable
- [x] event knowledge source-of-truth exists in code
- [?] niche event-knowledge coverage still needs manual editorial review over time

The calendar is one of the cleaner parts of the repo from a product-truth perspective. Its status model is explicit, its time handling is intentional, and it is tightly aligned with the MT5 bridge rather than being padded with fake convenience data. The event explainer work also has a clear source-of-truth shape instead of being scattered strings.

The caution here is file size and interaction complexity. `EconomicCalendarTab.tsx` has grown into a large operational component with significant UI state, fetch behavior, filters, popovers, navigation intent handling, and event-detail rendering. The behavior is meaningful, but the implementation would benefit from future extraction into smaller view-model and UI pieces before more features are added.

## Central Banks Data

- [x] central-bank snapshots are derived from MT5 calendar events
- [x] dual viewing modes exist: detailed command view and strategic focus view
- [x] policy rate, inflation, release dates, next-event dates, source labels, and node status are exposed
- [x] mapping audit logs and resolution counts are exposed
- [?] central-bank `N/A` behavior still needs live MT5 verification to confirm remaining unresolved nodes are truthful rather than derivation bugs
- [?] manual audit whether the current mapping coverage is good enough for daily use across all 8 currencies

The central-bank tab has a strong anti-slop principle at its core: unresolved values stay unresolved. That is a good sign. The tab is not trying to bluff its way into completeness, and the mapping audit log makes the derivation process inspectable, which is exactly what this product needs if it wants to remain trustworthy.

The remaining uncertainty is live-feed behavior rather than UI scaffolding. The derivation logic and tests look intentional, but this area still depends heavily on how MT5 event rows arrive in practice, especially for future blank rows, event title variations, and long-tail mapping edge cases. So this section is implemented, but not fully closed.

## Specialist Tools

- [x] `Differential Calculator` exists and is wired from live central-bank snapshots
- [x] `Strength Meter` exists with methodology disclosure
- [x] `Event Quality` exists with pair selection, horizon selection, weighted scoring, and methodology
- [x] `Event Reaction Engine` exists with upcoming-event study, pair-first study, historical context, pair ranking, and replay
- [x] specialist outputs already feed simplified context back into `Overview`
- [ ] `Strength Meter v2` does not exist yet
- [ ] `Event Reaction Engine -> Execution Prep` upgrade does not exist yet
- [?] manual audit whether `Event Quality` warnings are useful in practice rather than decorative
- [?] manual audit whether `Event Reaction Engine` is genuinely useful in a real workflow and not just impressive on paper

The specialist area is no longer fake breadth. All four tools exist and each has real logic behind it, with the important additional win that simplified versions of their outputs are already being pulled back into `Overview`. That reuse is a healthy sign because it means the tools are not isolated "AI feature islands."

The slop risk is asymmetry of maturity. `Differential Calculator` and `Strength Meter` are straightforward and easier to reason about. `Event Quality` is more interpretive but still bounded. `Event Reaction Engine` is the most ambitious surface, and because it mixes history loading, template discovery, ranking, replay, and study modes, it carries the highest risk of becoming "impressive but operationally soft" unless it is continually tested against actual trader use.

## Bridge And MT5 Surface

- [x] frontend bridge client supports `fetchHistory`, `fetchHistoryRange`, `fetchSymbols`, `fetchHealth`, `fetchServerTime`, `fetchCalendar`, `fetchMarketStatus`, and `openChartStream`
- [x] bridge server exposes `GET /health`, `GET /server_time`, `GET /symbols`, `GET /history`, `GET /history_range`, `GET /calendar`, `GET /market_status`, `POST /calendar_ingest`, and `WS /stream`
- [x] `calendar_ingest` trims trailing null bytes before JSON parsing
- [x] calendar rows are deduped by `(event id, event time)` instead of `id` alone
- [x] bridge health exposes `last_calendar_ingest_at`
- [x] bridge-side tests exist for calendar contract behavior and market-status/session helpers
- [x] bridge tests were executed in this pass and passed: 11 tests total
- [x] live `GET /health` currently reports `ok: true`, `terminal_connected: true`, and populated calendar event storage
- [x] live `GET /server_time` is responding
- [x] live `GET /market_status?symbol=EURUSD` is responding with open-session context and populated timestamps
- [x] live `GET /calendar` is responding and currently returns rows for a near-term queried window
- [?] manual audit still needed with a live MT5 terminal + EA to confirm ingest freshness, future blank-row preservation, next-event dates, and session-state behavior
- [?] `Main/mt5-bridge/server.py` still uses FastAPI `@app.on_event(...)`, which now emits deprecation warnings and should be migrated to lifespan handlers

The bridge is more grounded than the docs previously gave it credit for. It has a coherent contract surface, practical sanitation around `calendar_ingest`, useful health metadata, and session-aware market-status behavior. The frontend also clearly uses more of this surface than the old README files admitted.

This section is now better grounded because both test-level and live-runtime checks were run in this pass. The bridge test suite passed, the running bridge reported healthy MT5 connectivity, `server_time` and `market_status` responded correctly, and the calendar endpoint returned live rows. That closes a real confidence gap from the previous audit.

The biggest remaining bridge landmine is maintainability rather than outright failure. `server.py` still uses deprecated FastAPI `on_event` hooks for startup and shutdown, which now produce warnings during tests. That is not an urgent production failure, but it is the kind of quiet infrastructure drift that should be cleaned up before it becomes a future compatibility problem.

## Explicit Gaps / Not Started Yet

- [ ] `Watchlist Priority Engine`
- [ ] `Cross-Asset Alignment Map`
- [ ] `Tradeability Window Layer`
- [ ] `Multi-pair Overview`
- [ ] richer diagnostics surface for data health and operational state
- [ ] right-side expandable Overview panel
- [ ] final post-60/40 `Strength Meter` methodology

These are real absences, not hidden half-builds. That is actually useful because it makes the roadmap cleaner: the repo already has a meaningful present-tense product, and these next directions are genuinely optional next layers rather than unfinished stubs pretending to be complete.

The most important gap is still `Watchlist Priority Engine`, because it changes the product from "help me analyze the pair I selected" into "help me decide what deserves attention first." That would be a meaningful workflow jump. The rest should probably stay secondary unless real use proves otherwise.

## Future Core Feature Directions

- [ ] `Watchlist Priority Engine`
- [ ] `Cross-Asset Alignment Map`
- [ ] `Tradeability Window Layer`
- [ ] `Event Reaction Engine -> Execution Prep` upgrade
- [ ] `Strength Meter v2`
- [ ] `Multi-pair Overview`

This group belongs here because it is implementation-facing backlog, not settled product truth. These directions are still valuable, but they are not "what the product is" yet, and they should not blur the line between current capability and future ambition.

My current prioritization opinion is: `Watchlist Priority Engine` first, `Strength Meter v2` and `Tradeability Window Layer` after that, and only then broader scope items like cross-asset alignment or multi-pair overview. The repo does not need more surfaces as badly as it needs tighter workflow focus.

## Open Research / Open Questions

- [?] review whether ATR should remain `14D`, switch to `14H`, or expose more than one volatility context
- [?] decide whether the app should help identify the cleaner pair or asset expression of an active macro theme
- [?] define what `cleaner expression` should mean in practical, transparent terms
- [?] decide which currently accessible broker symbols belong in a first cross-market context layer
- [?] decide whether DXY and bond yields remain optional future enhancements instead of present dependencies

These are legitimate open questions, but they should stay visibly separate from "implementation missing" items. A lot of AI-built repos get sloppy because open research, active bugs, and backlog all collapse into one vague to-do list. Keeping this separate is the right call.

The key thing to guard against is premature sophistication. This repo already has enough moving pieces that adding new market-context layers too early could make the product feel smarter on paper while reducing clarity in daily use. Research should stay subservient to workflow truth.

## Things Explicitly Not Present Yet

- [ ] watchlist priority engine
- [ ] cross-asset alignment map
- [ ] tradeability window layer
- [ ] fully unified visual language across all tabs
- [ ] final Strength Meter methodology beyond the current 60/40 model
- [ ] final answer on whether Overview should summarize one pair or multiple pairs

This section is intentionally blunt. It helps keep the documentation honest by naming things that should not be inferred from the current UI or codebase just because adjacent groundwork exists.

This is especially useful in a repo shaped by multiple AI agents, because the visual presence of a module can easily imply a level of product completeness that has not actually been earned yet. A short explicit-not-present list is a good antidote to that drift.

## Docs And README Coherence Audit

- [x] root `README.md` is broadly coherent about repo entry points, root scripts, and the vendored bridge location
- [x] root `README.md` was cleaned so it no longer references missing `AGENT_INSTRUCTIONS/`
- [x] `Main/README.md` now reflects the real current app shape, including `Overview` and `Specialist Tools`
- [x] `Main/README.md` now documents the broader bridge/API surface the frontend actually uses
- [x] `Main/mt5-bridge/README.md` now includes `GET /history_range` and `GET /market_status`
- [x] roadmap docs are now consolidated around `checklist.md`, `PRODUCT_CONTRACT.md`, and `terminology.md`
- [x] previous doc drift was real, but it has been corrected in this pass

The documentation drift was real, but it was also very normal for a repo touched by multiple agents and multiple build phases. The important thing is that the drift was mostly descriptive drift, not deep architectural contradiction. The docs were behind the code, not pointing at a completely different app.

That said, stale README files are one of the fastest ways for slop to re-enter a repo, because they anchor future sessions to outdated assumptions. Keeping the docs synchronized with the real current app is one of the cheapest high-value cleanup moves available.

## Highest-Value Manual Audit Queue

- [?] verify `Overview` hierarchy under tired real-use conditions
- [?] verify `Overview Confidence` and event-risk wording feel honest
- [?] verify central-bank coverage against live MT5 feed behavior
- [?] verify `Event Quality` thresholds and warnings in real workflow use
- [?] verify `Event Reaction Engine` usefulness for pre-trade prep
- [?] verify cross-tab visual consistency before any new big feature push

If you only do a few manual checks, this is the short list that will tell you whether the repo is becoming more truthful or just more elaborate. These are the areas where a technically working implementation can still fail the real product.

## Honest Thoughts And Opinions

The repo is in much better shape than a typical multi-agent build. The good news is that the main problems are no longer fake features or empty shells. The real problems are concentration, drift, and consistency. The product has genuine substance now, especially in `Overview`, the calendar, the central-bank derivations, and the bridge contract.

The biggest de-slopify move now is to reduce ambiguity of ownership inside large files. `OverviewTab.tsx`, `EconomicCalendarTab.tsx`, and `EventReactionTab.tsx` are carrying too much mixed responsibility. They are not bad because they are long; they are risky because they mix data access, derivation, local persistence, workflow decisions, and presentation in one place. Splitting those into smaller hooks, selectors, and section components would make future changes calmer and easier to audit.

The second big move is design-system and language discipline. Right now the app has a strong product idea, but the tabs still look and speak like they were authored by different minds at different moments. A small shared library of semantic UI primitives, tone rules, and naming rules would do more good than another feature sprint.

The third big move is repo hygiene. The mix of `pnpm` workspace state plus `Main/package-lock.json`, and the frontend importing `framer-motion` while only declaring `motion`, are exactly the sort of quiet dependency landmines that accumulate in AI-assisted repos. They may not break today, but they weaken confidence in the build story. Tightening dependency authority, deleting leftovers, and making root scripts/test flows cover the bridge path more explicitly would pay off fast.

The final landmine is momentum bias. This repo is now capable enough that every new session could easily add one more surface, one more card, one more heuristic. That is the point where AI slop becomes "featureful slop." My honest opinion is that the next stretch should be more audit, extraction, naming cleanup, live-feed verification, and consistency work than net-new feature building.

## Direction Recommendation: Practical Product First

This section is intentionally opinionated.

My current recommendation is to stop treating `Overview` as the place where unfinished specialist logic gets promoted into product truth. The repo is already far enough along that the next completion move should not be "add more summaries to Overview" or "add more features because the shell can hold them." The next move should be to make the specialist tabs operationally useful enough that their outputs deserve to be surfaced upstream.

In other words: yes, the priority should be major overhaul / tightening of the specialist tools first, then a calmer `Overview` pass, and only after that broader feature expansion.

### Why this direction is the right one

- `Overview` already answers a lot: trust, macro backdrop, pair attention, event radar, confidence, and pair opportunity framing.
- The specialist tabs are the part of the app that most directly claim to provide edge, but they are also the part where interpretive logic and practical usefulness are least closed.
- Pulling immature specialist outputs into `Overview` too early makes the whole product feel smarter than it really is.
- A practical trading product is not complete when it has many tabs. It is complete when each surface earns its place in a real workflow.

### Practical product principle

Every specialist tab should answer one concrete workflow question better than a trader could answer it quickly by glancing at the raw calendar and chart.

The standard should be:

- `Differential Calculator`: is the macro rate spread actually favorable, and is the source data trustworthy?
- `Strength Meter`: which currencies are structurally stronger or weaker right now, and how trustworthy is that ranking?
- `Event Quality`: is this pair tradable from a timing and macro-noise perspective over the selected horizon?
- `Event Reaction Engine`: if a key event is coming, which pair is the cleanest expression and what kind of move behavior should I realistically prepare for?

If a tab cannot answer its workflow question clearly, quickly, and honestly, it is not ready to be summarized into `Overview`.

### Recommended build order from here

- [ ] Freeze net-new feature expansion until specialist-tab usefulness is materially improved
- [ ] Treat `Overview` as a thin mission-control layer, not the main place where experimental logic gets invented
- [ ] Upgrade each specialist tab so it produces explicit, decision-supporting outputs with visible limitations
- [ ] Re-import only the proven specialist outputs back into `Overview`
- [ ] Add new features only after the specialist layer is stable enough to support them

### Specialist overhaul priorities

#### 1. `Event Reaction Engine` should be the first major overhaul

This is the highest-upside tool, but also the easiest one to become impressive without being actionable.

Right now it already does a lot: upcoming-event study, pair-first study, template discovery, ranking, historical replay, and contextual metrics. That is good groundwork, but practical use requires one more product step: it should help the user prepare for an actual upcoming event, not just study past movement.

The next version should focus on turning it into pre-trade preparation:

- [ ] identify the cleanest pair expression for a selected upcoming event
- [ ] show whether the historical sample is strong enough to trust
- [ ] separate directional bias from pure volatility expectation
- [ ] show typical post-event behavior by timeframe in plain trader language
- [ ] explicitly warn when the sample is too weak, too mixed, or too regime-dependent to trust
- [ ] end with a concise preparation output such as `focus`, `study only`, or `do not lean on this`

If there is one specialist tab that can make the app feel practically unique, it is this one.

#### 2. `Event Quality` should become a true tradeability filter

This tab already has a clean bounded shape, which is a strength. The problem is not scope; the problem is whether the score translates into a practical trading decision.

The upgrade target should be:

- [ ] make the output clearly answer `tradable now`, `tradable with caution`, or `avoid due to event noise`
- [ ] explain the dominant reason in one sentence, not only in weighted rows
- [ ] make horizon choice materially change the recommendation in an understandable way
- [ ] verify thresholds against real use so the warnings are not decorative
- [ ] connect the result to session timing and event clustering, not only family-weight totals

This is probably the fastest path to a specialist tab that helps both you as builder and the end user immediately.

#### 3. `Strength Meter` should be upgraded only after the above two

The current version is coherent, but still clearly heuristic. It is useful as context, but not yet strong enough to serve as a practical edge engine by itself.

The next version should not just produce a prettier ranking. It should answer why the ranking matters now and how much confidence to place in it.

Upgrade target:

- [ ] add confidence / coverage language around missing or partially resolved macro inputs
- [ ] decide whether the model remains structural-only or adds recency / momentum context
- [ ] make the pair suggestions feel like prioritized opportunities rather than sorted combinations
- [ ] validate whether `60/40` should survive as the public methodology

This should be a serious methodology pass, not just UI polish.

### What `Overview` should become after that

After the specialist tools are stronger, `Overview` should be updated second, not first.

Its role should be:

- [ ] surface only the most decision-useful outputs from validated specialist logic
- [ ] stay fast to scan
- [ ] remain honest about uncertainty
- [ ] route the user into the right deep-dive tab when confidence is low or nuance matters

The test for `Overview` should be simple:

- can it tell me what deserves attention now
- can it tell me why
- can it tell me whether I should trust that read
- can it tell me where to drill deeper next

Anything beyond that should be treated skeptically.

### Completion definition for this product phase

I would define the next meaningful version of "complete as a practical product" like this:

- [ ] the specialist tabs each answer a concrete workflow question
- [ ] their outputs survive live manual use without feeling decorative
- [ ] `Overview` summarizes proven outputs instead of compensating for weak ones
- [ ] the app can help the user decide what to watch, what to avoid, and what to prepare for
- [ ] new feature work resumes only after that workflow is stable

### Bottom-line recommendation

The right direction is not broader feature breadth right now. The right direction is depth, honesty, and operational usefulness in the specialist layer.

If I were steering the next stretch, I would do it in this order:

1. `Event Reaction Engine` overhaul into execution-prep / event-prep usefulness
2. `Event Quality` overhaul into a real tradeability filter
3. `Strength Meter` methodology pass
4. `Overview` simplification and reintegration of only the proven outputs
5. only then resume net-new features such as watchlist priority, tradeability windows, or cross-asset context

That path gives the app a much better chance of becoming a practical trading product instead of a sophisticated-feeling dashboard.
