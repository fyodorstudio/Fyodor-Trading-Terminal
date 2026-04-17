# Current Slop In Repo

Status snapshot as of April 16, 2026.

This document captures the current state of the `Overview` tab and the 4 tabs inside `Specialist Tools`:

1. `Overview`
2. `Differential Calculator`
3. `Strength Meter`
4. `Event Quality`
5. `Event Reaction Engine`

This is not a praise document. The goal is to preserve the useful skeleton, identify where the repo is still carrying decorative or weak logic, and map everything back to the actual product problem stated in [`docs/Reference/Notes/Developer Clause.md`](../Reference/Notes/Developer%20Clause.md).

## Product Truth From Developer Clause

The owner says the app exists to sit beside TradingView, not replace it.

TradingView remains the place for:

- chart read
- structure
- entries
- SL / TP planning
- execution

This app is supposed to reduce manual research around:

- what is moving price
- which side is winning
- why that side is winning
- whether the move is trustworthy enough to respect
- whether events support or threaten the setup
- whether another pair expresses the same theme better

So the standard for usefulness is simple:

- does this surface improve pair selection, timing awareness, macro context, or theme expression?
- does it do that honestly?
- does it do that better than the user glancing at TradingView plus the raw calendar?

Anything below that bar is slop, even if the UI looks polished.

## App-Level Wiring

Relevant shell: [`Main/src/app/App.tsx`](../../Main/src/app/App.tsx)

Important app facts:

- `Specialist Tools` is only a navigation label. The actual child tabs are `dashboard`, `strength-meter`, `event-quality`, and `reaction-engine`.
- `dashboard` is the code id for `Differential Calculator`.
- `Overview` receives live bridge health, feed status, market status for one selected symbol, all calendar events, and all central-bank snapshots.
- `Overview` can deep-link into the calendar and specialist tabs.
- Central-bank snapshots are derived from MT5 events, not entered manually.
- The frontend refreshes bridge health, calendar data, and market status on intervals.

The broad skeleton is correct: one orientation surface and several deeper specialist tabs.

The broad slop risk is also obvious: `Overview` is already trying to be the mission-control layer, ranking layer, trust layer, event layer, and partial specialist-summary layer at the same time.

## 1. Overview

Main component: [`Main/src/app/tabs/OverviewTab.tsx`](../../Main/src/app/tabs/OverviewTab.tsx)

Core derivation logic: [`Main/src/app/lib/overview.ts`](../../Main/src/app/lib/overview.ts)

### What it currently is

`Overview` is a very large mission-control tab for one selected FX pair. It is not a placeholder. It has real logic and real data dependencies.

It tries to answer:

- can the app be trusted right now?
- should this pair be studied now or later?
- which side is winning?
- are macro, strength, and event timing aligned?
- what are the best pairs right now?
- what do some specialist modules say in compact form?

### Inputs and runtime behavior

`Overview` receives:

- `currentTime`
- `health`
- `feedStatus`
- `marketStatus`
- `reviewSymbol`
- `events`
- `snapshots`

It also fetches a lot on its own:

- for every pair in `FX_PAIRS`, it loads `D1`, `H1`, and `H4` history
- it computes D1 ATR and H1 ATR for every pair
- it stores candle sets for cross-pair ranking logic

Important implementation detail:

- this tab is doing its own multi-pair historical loading with `fetchHistory(...)` across the whole board
- the fetch load is triggered again when ATR settings change
- that means `Overview` is not just a summary surface; it is a data orchestration surface too

### Local persistence

`Overview` persists these to `localStorage`:

- chart favorites
- overview view mode (`strategic` vs `command`)
- ATR configuration

### Current UI structure

The tab is split into three columns plus a specialist strip and multiple overlays.

Left column:

- `Trust State`
- `Action Plan`
- `Terminal Ingest`

Center column:

- pair selector / mission-control header
- view mode switch
- ATR display and ATR settings
- main verdict banner
- either `Strategic` dominance pillars or `Command` side-by-side matrix
- `Who Is Winning Now`
- `Best Pairs Right Now`
- `Macro Backdrop`
- `Overview Confidence`

Right column:

- event radar / timeline for top upcoming high-impact events

Bottom specialist strip:

- compact cards for `Strength Meter`
- `Differential Calculator`
- `Event Quality`

Notably missing:

- there is no `Event Reaction Engine` compact summary inside `Overview`

That is important because the app claims 4 specialist tools, but `Overview` only re-imports 3 of them.

### Current derived logic inside Overview

`Overview` computes all of these locally:

- `trustState`
- `strengthBoard`
- `topEvents`
- `macroSummary`
- `strengthSummary`
- `eventSensitivity`
- `macroVerdict`
- `pairAttentionVerdict`
- `dominance`
- `priceAlignment`
- `winningNow`
- `actions`
- `pipelineStatus`
- `trustInspector`
- `radarSummary`
- `specialistSummaries`
- `sortedPairs`
- `topOpportunities`

This is a lot. The file is doing data loading, derivation, ranking, storage, UI state, drill-down behavior, and presentation all together.

### Current Overview heuristics

Important actual logic living in `overview.ts`:

- `getMacroSummary(...)`
  - compares base vs quote policy rate
  - compares base vs quote inflation
  - only calls macro aligned if rate diff and inflation diff favor the same side

- `getStrengthDifferentialSummary(...)`
  - delegates to the strength-board logic and returns stronger side, weaker side, score gap, and decisiveness

- `getEventSensitivity(...)`
  - looks only at upcoming high-impact events relevant to the pair
  - `High-risk soon` if within 2 hours
  - `Event-sensitive` if within 24 hours
  - otherwise `Clear`

- `getPriceAlignment(...)`
  - uses EMA-20 structure on D1 and H1
  - tries to classify price bias as base / quote / mixed / unresolved

- `getWhoIsWinningNow(...)`
  - combines macro summary, strength summary, event sensitivity, trust state, session context, ATR, and price alignment
  - returns winner, conviction, reasons, risks, summary, and `Focus now / Study / Monitor / Avoid for now`

- `getPairOpportunitySummary(...)`
  - scores every pair with weighted components:
  - directional clarity max 35
  - price confirmation max 25
  - tradeability max 20
  - event safety max 15
  - trust quality max 5

- `getOverviewPipelineStatus(...)`
  - builds the confidence meter from trust state, calendar timing, selected-symbol context, and macro coverage

### What is genuinely useful in Overview

- The trust-state layer is useful because it explicitly tells the user when the app should not be trusted.
- The event radar is useful because it quickly surfaces pair-relevant event timing.
- The macro summary plus strength summary plus price alignment is the right kind of triage logic for a discretionary trader.
- The `Best Pairs Right Now` list is pointed at the real problem: choosing which chart deserves attention first.
- The specialist deep-dive strip is conceptually right: deeper modules should feed compact end-results back into mission control.

### What is still slop or risky in Overview

- The file is too large and mixes too many responsibilities.
- The tab is no longer just orientation; it is quietly becoming a ranking engine for the whole app.
- `Overview` fetches and stores board-wide candles itself, which makes it both heavy and centralizing.
- The pair-opportunity scoring is heuristic-heavy. It may be directionally helpful, but it is still mostly authored weighting logic, not proven edge.
- The `Overview Confidence` meter is useful as honesty infrastructure, but it can still drift into "smart-looking control panel" territory if the user stops trusting the underlying weights.
- `Strategic` vs `Command` view mode is a presentation split, not a workflow breakthrough.
- Some of the language sounds decisive before the specialist layer is truly battle-tested.
- `Overview` is already re-importing immature specialist outputs upstream.
- `Event Reaction Engine` is not represented in the specialist summaries, which means the specialist-to-overview bridge is inconsistent.

### Surgical keep / trash view for Overview

Keep:

- trust state
- pair-relevant event radar
- macro backdrop summary
- pair opportunity shortlist
- drill-down links into deeper tabs

Keep but harden:

- who-is-winning logic
- price alignment logic
- confidence meter
- specialist summaries

Possible trash or shrink:

- any overly dramatic wording that implies edge beyond the actual logic
- duplicated layers that say the same thing in different visual forms
- too many weighted summaries living in one tab

### Overview verdict against Developer Clause

`Overview` is pointed at the correct problem, but it is overstuffed. It is not useless. The skeleton is strong. The slop is not "fake tab" slop anymore; it is "too much intelligence claimed in one place before the specialist layer is truly sharp" slop.

## 2. Differential Calculator

Main component: [`Main/src/app/tabs/DashboardTab.tsx`](../../Main/src/app/tabs/DashboardTab.tsx)

Core logic: [`Main/src/app/lib/macroViews.ts`](../../Main/src/app/lib/macroViews.ts)

### What it currently is

This tab is a simple arithmetic macro comparison surface across the 28 major FX pairs.

It exposes two blocks:

- `Interest Rate Differential + Trend`
- `Inflation Differential`

The tab receives only:

- `snapshots: CentralBankSnapshot[]`

There is no direct event input, no price input, and no pair-specific workflow state beyond the cards themselves.

### Current UI controls

- a flag row for excluding currencies
- a sort dropdown for rate cards
- a sort dropdown for inflation cards

Excluding a currency removes any pair card containing that currency.

### Actual logic

`adaptDashboardCurrencies(...)` parses snapshot strings into numeric rates and inflation values.

`deriveDashboardRateCards(...)` computes:

- current gap = base current rate - quote current rate
- previous gap = base previous rate - quote previous rate
- trend = current gap - previous gap
- `isWidening` if trend is positive

`deriveDashboardInflationCards(...)` computes:

- bias = base current inflation - quote current inflation

Cards are marked:

- `ok`
- `partial`
- `missing`

### What it currently shows well

- raw arithmetic between currencies
- whether a rate differential is widening or narrowing
- unresolved / partial data states
- fast scan of macro gap structure across many pairs

### What is slop or limited here

- By itself, this tab does not answer the real trading workflow question. It mostly says "here is the arithmetic."
- Inflation differential is shown as a raw bias, but the tab does not interpret whether that inflation is supportive, hostile, stale, or already known by price.
- Rate-gap widening / narrowing is a nice skeleton, but still very primitive.
- There is no timing layer.
- There is no direct connection to event sequencing.
- There is no explicit "which pair is the cleaner expression of a theme right now?" output.
- It is useful as a component, not yet as a decision tool.

### Skeleton worth keeping

- base-minus-quote differential logic
- previous vs current differential change
- partial / missing-state honesty
- fast board-wide scan

### What probably belongs in the garbage unless upgraded

- any idea that this tab alone provides edge
- the current interpretation text on inflation cards, which is mostly descriptive filler
- treating raw arithmetic cards as an endpoint instead of a feeding layer into stronger pair-selection logic

### Differential Calculator verdict against Developer Clause

This tab is not useless, but it is closer to a data table with decent presentation than a true decision-support surface. The skeleton is valid. The edge is not there yet.

## 3. Strength Meter

Main component: [`Main/src/app/tabs/StrengthMeterTab.tsx`](../../Main/src/app/tabs/StrengthMeterTab.tsx)

Core logic: [`Main/src/app/lib/strengthMeter.ts`](../../Main/src/app/lib/strengthMeter.ts)

### What it currently is

This is no longer the old legacy 60/40 rate/inflation-only strength tab. The current version is a composite board-strength engine.

It tries to rank currencies and shortlist pairs by combining:

- price impulse
- recent event push
- structural backdrop

Its own visible footer states:

- `55% Price Impulse`
- `25% Event Push`
- `20% Macro Backdrop`

### Inputs and runtime behavior

The tab receives:

- `snapshots`
- `events`
- `status`
- `onOpenCalendarEvent`

It also fetches:

- D1 history for every pair
- H4 history for every pair

If enough history cannot be resolved, it marks the engine offline or partial.

### Current UI structure

- hero header with engine status
- `Open First` shortlist cards
- `Major Map` currency chips
- methodology / tactical use / trust limits footer
- detail drawer for either a pair or a currency

### Actual logic

The strength engine builds 3 sub-scores per currency:

1. `Price strength`
   - derived from D1 and H4 impulse plus EMA distance
   - coverage depends on enough D1 and H4 candles existing

2. `Recent event push`
   - looks at medium and high impact events within the last 7 days
   - classifies event family using the same family system as `Event Quality`
   - compares actual vs forecast or previous
   - inverts surprise for unemployment / jobless-style releases
   - decays by recency

3. `Structural backdrop`
   - derived from rate level and real-rate proxy
   - ranks currencies relative to each other using percentile logic

These are blended into a normalized composite score for each major currency.

Then for each FX pair:

- identify stronger vs weaker currency
- compute score gap
- check whether the direct pair impulse agrees with the broader board read
- penalize for partial data
- penalize if a relevant high-impact event is due within 24h
- produce label:
  - `Open first`
  - `Backup watchlist`
  - `Skip for now`

### What is genuinely useful here

- This tab is very close to the real product need of "which chart should I open first?"
- It is pair-selection oriented, not entry-signal theater.
- It uses price, events, and structural macro together instead of pretending one source is enough.
- The detail drawer exposes evidence rather than only a magic score.
- It can deep-link to relevant calendar events.

### What is still slop or weak here

- The weighting scheme is still handcrafted heuristic logic.
- Event push depends on title classification and numeric parsing, which is fragile.
- Structural backdrop uses percentile ranking inside the major-8 universe, which is useful but still synthetic.
- The shortlist score is not yet calibrated against real trading outcomes.
- The hero / cinematic UI language is more confident than the model deserves.
- Some text still sounds like a premium engine even though the underlying logic is a still-developing composite heuristic.

### Skeleton worth keeping

- pair-first shortlist behavior
- stronger vs weaker currency logic
- direction-agreement check between board read and actual pair
- event-risk penalty
- evidence lines
- calendar deep-linking

### What likely needs brutal tightening

- title classification reliability
- event-surprise normalization
- how much the score should trust percentiles vs direct pair evidence
- wording that oversells the engine

### Strength Meter verdict against Developer Clause

Of the specialist tabs, this is one of the clearest attempts to solve the actual user problem. It is not garbage. It is an unfinished edge engine with a good skeleton and still-too-subjective weighting.

## 4. Event Quality

Main component: [`Main/src/app/tabs/EventQualityTab.tsx`](../../Main/src/app/tabs/EventQualityTab.tsx)

Core logic: [`Main/src/app/lib/eventQuality.ts`](../../Main/src/app/lib/eventQuality.ts)

### What it currently is

This tab is a pair-specific macro timing filter.

It asks:

- how dirty or clean is the event environment for this pair in the chosen horizon?

This is exactly the right kind of question for the product.

### Inputs and controls

Inputs:

- `events`
- `status`
- `lastCalendarIngestAt`

Controls:

- selected pair
- horizon: `24h`, `72h`, `This Week`

The selected pair is persisted in `localStorage`.

### Event family model

This tab classifies event titles into weighted families:

- `policy` weight 8
- `inflation` weight 7
- `labor` weight 6
- `gdp` weight 5
- `activity` weight 4
- `trade_confidence` weight 3

Impact multipliers:

- high = `1`
- medium = `0.65`
- low = `0.35`

Noisy keywords are excluded, including things like:

- speeches
- testimony
- minutes
- auctions
- liquidity operations
- some housing-related releases

### Actual scoring logic

For the selected horizon:

- only upcoming events are considered
- only events touching the pair base or quote are counted
- each counted event gets `family weight x impact multiplier`
- total score is summed
- base-side and quote-side loads are also summed separately

Thresholds:

- `24h`: mixed at `4`, dirty at `8`
- `72h`: mixed at `6`, dirty at `12`
- `This Week`: mixed at `8`, dirty at `16`

Hard override:

- if a high-impact `policy`, `inflation`, or `labor` event is due within 24 hours, label becomes `dirty`

### Current UI structure

- top summary card
- weighted-breakdown card
- relevant-events table
- methodology card

The summary card shows:

- total weighted score
- base load
- quote load
- horizon window
- feed status
- last ingest

### What is genuinely useful here

- The question is clean and practical.
- The logic is transparent.
- The methodology is visible.
- It does not pretend to forecast direction.
- It is directly useful for "is this a clean environment to respect?"

### What is slop or weak here

- It treats title-family classification as a stable truth, but title matching is brittle.
- It scores event environment quantity and type, not the actual likely market relevance in current context.
- It does not distinguish between well-anticipated and market-moving releases beyond family and impact.
- It does not consider whether the market is already positioned for the event.
- It does not incorporate the pair's current technical fragility or structural context.
- A weighted score can look more scientific than it really is.

### Skeleton worth keeping

- the pair-specific timing question
- family weighting
- explicit methodology visibility
- clean / mixed / dirty labeling
- hard override for near-term major events

### What needs care

- family detection rules
- threshold calibration
- avoiding false certainty from a single summed score

### Event Quality verdict against Developer Clause

This tab is one of the cleanest conceptually. It solves a real sub-problem. The slop is not the workflow question; the slop is the fragility and simplification of how the score is built.

## 5. Event Reaction Engine

Main component: [`Main/src/app/tabs/EventReactionTab.tsx`](../../Main/src/app/tabs/EventReactionTab.tsx)

Core logic: [`Main/src/app/lib/eventReaction.ts`](../../Main/src/app/lib/eventReaction.ts)

### What it currently is

This is the most ambitious specialist tab.

It tries to answer two real trader questions:

1. `Study an upcoming event`
2. `Study a pair`

The promise is strong:

- start from an upcoming release and replay how price reacted in the past
- or start from a pair and inspect which events historically move it

This is exactly the kind of thing that could become real edge if done honestly and tightly.

### Inputs and runtime behavior

The tab receives:

- `events`

Then it does substantial historical work itself:

- discovers historical event templates from prior calendar events
- groups events by exact `currency | title`
- loads historical price candles in monthly chunks
- builds reaction studies across multiple windows
- loads replay candles for the selected pair and timeframe

It uses heavy `localStorage` persistence for:

- task mode
- pair
- event currency
- event family
- pair family
- include weak templates
- selected template
- replay timeframe

### Core model

The engine classifies historical event outcomes into:

- `beat`
- `inline`
- `miss`

And when enough history exists, also magnitude buckets:

- `small beat`
- `large beat`
- `small miss`
- `large miss`

Reaction windows:

- `15m`
- `1h`
- `4h`
- `1d`

For each sample it measures:

- percent move
- pip move

Then it builds statistics such as:

- average return
- median return
- median absolute return
- standard deviation
- average pips
- median pips
- median absolute pips
- standard deviation in pips

### Two study modes

`Event-first` mode:

- choose an upcoming event or manual event template
- find relevant FX pairs for that event currency
- rank pairs by historical 1h median absolute move

`Asset-first` mode:

- choose a pair
- choose event family or exact event
- rank event templates by historical 1h median absolute move for that pair

### Historical replay behavior

The replay section:

- fetches replay candles for the selected pair and timeframe
- slices a fixed window around a historical release
- sets the event candle index
- allows previous / next sample navigation
- animates candle reveal using play / pause

The replay chart is custom SVG, not a full charting library surface.

### What is genuinely useful here

- The workflow question is excellent.
- Historical response by event type is exactly the kind of context that can help decide whether a setup deserves respect.
- Event-first mode can help find the cleaner pair expression of an active macro theme.
- Asset-first mode can help explain what usually moves a pair.
- The replay mechanic is much more concrete than a static score.

### What is slop or weak here

- Event templates are grouped by exact `currency | title`, which is brittle.
- Historical sample quality is driven mainly by count thresholds, not by regime similarity.
- The main rank metric is `1h median absolute pips`, which is useful but crude.
- It measures historical movement, not whether the move was tradeable, trustworthy, or directionally consistent with the current backdrop.
- Replay theater can easily feel insightful even when the sample set is weak.
- The engine still depends on the same event title classification fragility as `Event Quality`.
- A lot of complexity is packed into one tab file, one derivation file, and several async flows.

### Very important current limitation

This tab is probably the closest thing in the repo to a future unique edge, but it is not yet being surfaced back into `Overview`.

That means:

- it is strategically important
- but still product-isolated

This is probably correct for now, because it is not mature enough yet to be summarized as settled truth.

### Skeleton worth keeping

- event-first and asset-first study modes
- historical template discovery
- sample-quality labels
- ranking by actual historical movement
- replayable candle windows
- pair-order preview and related-events preview

### What needs the hardest redesign thinking

- event-template normalization
- sample-quality standards
- whether rank should prefer absolute move, directional consistency, post-event cleanliness, or some blended measure
- how to connect current upcoming event context to historical analog quality
- how to avoid "beautiful toy" syndrome

### Event Reaction verdict against Developer Clause

This tab is not useless. It is the most dangerous in both directions:

- biggest future edge potential
- biggest risk of becoming an impressive-looking but weakly grounded toy

## Cross-Tab Slop Patterns

Across these surfaces, the recurring repo problems are:

- too many handcrafted weights
- too much title-matching dependence
- large tabs mixing data loading, derivation, persistence, and presentation
- polished wording sometimes outrunning validated usefulness
- `Overview` importing specialist outputs before the specialist layer is fully battle-tested

The repo is not suffering mainly from empty-placeholder slop anymore.

It is suffering from:

- over-concentrated logic
- heuristic inflation
- smart-looking summary layers that still need operational proof

## What Has Real Skeleton

If the goal is surgical salvage, these are the strongest bones:

- `Overview` as orientation-first mission control
- trust-state honesty
- pair-relevant event radar
- pair ranking / shortlist logic
- `Differential Calculator` as raw macro comparison feed, not end product
- `Strength Meter` as pair-first chart-priority engine
- `Event Quality` as timing cleanliness filter
- `Event Reaction Engine` as historical context / theme-expression lab

## What Is Most Likely Disposable

These are the things to distrust first when pruning:

- dramatic wording that sounds smarter than the model
- duplicate summary layers in `Overview`
- any scoring output treated as edge without proving workflow usefulness
- pure arithmetic displays presented as decision tools
- compact specialist summaries that import immature logic too early

## Priority Recommendation

If the repo is going to be de-slopped in the way the owner actually wants, the order should probably be:

1. Harden `Event Reaction Engine`
2. Tighten `Strength Meter`
3. Clarify what `Differential Calculator` is allowed to be
4. Keep `Event Quality`, but calibrate and simplify where needed
5. Only then shrink and calm `Overview`

Reason:

- `Overview` should summarize proven logic, not compensate for weak specialist tabs.
- `Strength Meter` and `Event Reaction Engine` are the two tabs closest to real edge.
- `Differential Calculator` is useful as supporting arithmetic, but it should not pretend to be more than that unless upgraded.
- `Event Quality` already asks the right question and mostly needs calibration, not reinvention.

## Short Version

The repo already has real analytical structure. The problem is no longer "useless fake product shell."

The current slop is:

- oversized orchestration inside `Overview`
- heuristic-heavy specialist logic being dressed in high-confidence UI
- too much reliance on title parsing and handcrafted weighting
- not enough proof yet that the outputs create trading edge in the exact workflow described by the owner

The good news is that the skeleton is real.

The bad news is that the skeleton is currently wrapped in enough premature interpretation that it can still feel smarter than it actually is.
