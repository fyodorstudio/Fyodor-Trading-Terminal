# Strength Meter Tab Handoff

Status snapshot as of April 16, 2026.

This document captures the current implementation of the `Strength Meter` tab exactly as it exists today in the app, so another AI can redesign it without needing to reverse-engineer the current behavior first.

## Where the tab lives

- Main component: [`Main/src/app/tabs/StrengthMeterTab.tsx`](../../Main/src/app/tabs/StrengthMeterTab.tsx)
- Supporting strength-ranking helpers: [`Main/src/app/lib/macroViews.ts`](../../Main/src/app/lib/macroViews.ts)
- Pair definitions and major-currency ordering: [`Main/src/app/config/fxPairs.ts`](../../Main/src/app/config/fxPairs.ts)
- Shared type definitions: [`Main/src/app/types.ts`](../../Main/src/app/types.ts)
- Styling hooks: [`Main/src/styles.css`](../../Main/src/styles.css)
- Tab registration in the app shell: [`Main/src/app/App.tsx`](../../Main/src/app/App.tsx)

## Current purpose of the tab

The tab is a heuristic relative-strength dashboard for the major 8 currencies. It is explicitly framed as a legacy-weighted view that combines:

- current policy rate position
- current inflation position

The visible methodology on the page says:

- each resolved currency is normalized to a 0-10 range for current policy rate and current inflation
- final score = `0.60 x rate score + 0.40 x inflation score`
- the score is a relative ranking heuristic inside the current major-8 set, not a directional trade score

The tab has two user-facing control surfaces:

- a major-currency exclusion toggle row labeled as “Suggested pairs”
- a suggestion sort dropdown

The tab then shows:

- live currency rankings
- suggested trading pairs
- methodology

## Runtime data flow

### Input

The tab receives:

- `snapshots: CentralBankSnapshot[]`

That prop comes from `deriveCentralBankSnapshots(feedEvents)` in `App.tsx`.

### Data conversion

Inside `StrengthMeterTab.tsx`:

1. `adaptDashboardCurrencies(snapshots)` converts `CentralBankSnapshot[]` into dashboard currency objects.
2. `deriveStrengthCurrencyRanks(currencies)` turns those into ranked currency strength records.
3. `deriveStrengthSuggestions(ranks, excludedCurrencies, suggestionSort)` generates pair suggestions.

### Local UI state

The tab maintains two pieces of local state:

- `suggestionSort`, defaulting to `"spreadDesc"`
- `excludedCurrencies`, a `Set<string>` initially empty

These are purely view-level controls and do not persist outside the component.

### Memoized derivations

The component memoizes:

- `currencies` from `snapshots`
- `ranks` and `excluded` from `currencies`
- `suggestions` from `ranks`, `excludedCurrencies`, and `suggestionSort`

### User interaction

The major currency buttons toggle membership in the `excludedCurrencies` set.

- if a currency is present, it is removed
- if not present, it is added

The excluded set changes only the suggestion list. It does **not** change the live rankings currently rendered on screen.

## Current ranking logic

The core ranking logic lives in [`macroViews.ts`](../../Main/src/app/lib/macroViews.ts).

### Currency eligibility

`deriveStrengthCurrencyRanks` splits the incoming currencies into:

- `resolved`: currencies with both `currentPolicyRate` and `currentInflationRate`
- `excluded`: currencies missing either current policy rate or current inflation

Any currency missing one of those current values is removed from the ranking and surfaced in the “Excluded from scoring” alert.

### Score calculation

For resolved currencies:

- policy rates are normalized from the min/max current policy rate across the resolved set
- inflation rates are normalized from the min/max current inflation rate across the resolved set
- both normalized values are scaled to a 0-10 range

The final score is:

- `0.6 * rateScore + 0.4 * inflationScore`

The helper rounds the stored values to one decimal place.

### Sort order

The ranked currency list is sorted descending by `score`.

### Ties and normalization edge cases

If all resolved current policy rates are identical:

- `rateScore` falls back to `5`

If all resolved current inflation rates are identical:

- `inflationScore` falls back to `5`

This means a perfectly flat resolved set still yields a middle-of-the-road score instead of a divide-by-zero failure.

### Excluded list wording

The tab uses the `excluded` output from the ranking helper to render a message like:

- “Excluded from scoring because MT5 does not currently resolve both current rate and current inflation: ...”

That wording is important because it tells the user the exclusion is driven by unresolved data, not by their manual toggle row.

## Current suggestion logic

`deriveStrengthSuggestions` builds all pair combinations from the ranked currencies:

- strong side = earlier/higher-ranked currency
- weak side = later/lower-ranked currency
- spread = difference between the two scores, rounded to one decimal

It then filters out any pair where either currency is manually excluded.

### Sort modes

The suggestion dropdown offers:

- `spreadDesc`: highest differential first
- `spreadAsc`: lowest differential first

### Output shape

Each suggestion card displays:

- strong currency and flag
- weak currency and flag
- strong score
- weak score
- strength differential

### Important behavior note

The suggestion list is exhaustive across all eligible strong/weak currency combinations, not just one “best pair.”

## Tab structure

The tab is built as a `section` using the shared macro-panel layout and consists of four main visible blocks:

### 1. Section head

Contains:

- title: `Strength Meter`
- subtitle: `Relative ranking across the major 8 using the legacy 60/40 rate and inflation weighting.`

### 2. Toolbar

Contains:

- a `Suggested pairs` label
- a row of 8 flag buttons in this exact major-currency order:
  - USD
  - EUR
  - GBP
  - JPY
  - AUD
  - CAD
  - NZD
  - CHF
- a suggestions sort dropdown

Each flag button:

- is rendered from `MAJOR_CURRENCY_ORDER`
- derives the flag code from the matching snapshot’s `countryCode`, or falls back to the first two letters of the currency
- toggles muted styling when excluded

### 3. Excluded warning

If any currencies are unresolved in the scoring sense, an alert panel appears.

### 4. Live rankings

Shows the ranked currencies in order, including:

- rank number
- currency identity with flag
- strongest/weakest label
- strength score and visual bar
- rate score
- inflation score
- up/down icon

### 5. Suggested pairs

Shows all generated pair suggestions in a 2-column grid.

### 6. Methodology

Shows three short explanatory lines.

## Live rankings section details

Each ranking row contains:

- `strength-rank`: large ordinal number
- `strength-currency`: flag + currency code + secondary label
- `strength-meter-bar`: score label, numeric score, and a fill bar
- `strength-breakdown`: separate rate and inflation sub-scores
- `strength-icon`: trending-up or trending-down icon

### Rank labels

The small label beneath the currency changes by row position:

- first row: `Strongest`
- last row: `Weakest`
- middle rows: `Rank N`

### Icon choice

The icon is determined by row index:

- top half of the ranked list: `TrendingUp`
- bottom half: `TrendingDown`

That means the icon is based on visual ordering, not on the underlying rate or inflation values.

### Bar fill

The bar width is set to:

- `rank.score * 10%`

Because scores are on a 0-10 scale, a score of 10 renders a 100% width fill.

## Suggested pair card details

Each suggestion card contains:

- strong side block
- slash divider
- weak side block
- meta block with scores
- footer with spread

### Strong side

- flag
- currency code
- label: `Long side`

### Weak side

- currency code
- label: `Short side`
- flag placed on the right

### Score display

The card shows:

- strong score
- weak score
- spread in points

## Methodology text currently shown

The tab currently displays these ideas in plain language:

- each resolved currency is normalized to a 0-10 range for current policy rate and current inflation
- final score is 60% rate score and 40% inflation score
- the score is a relative ranking heuristic inside the current major-8 set, not a directional trade score

## Styling hooks currently used

The tab relies on the following CSS classes in [`Main/src/styles.css`](../../Main/src/styles.css):

- `.macro-block`
- `.macro-block-head`
- `.macro-card-grid`
- `.macro-card`
- `.macro-card-grid.suggestions`
- `.strength-list`
- `.strength-row`
- `.strength-rank`
- `.strength-currency`
- `.strength-meter-bar`
- `.strength-meter-head`
- `.strength-track`
- `.strength-fill`
- `.strength-breakdown`
- `.strength-icon`
- `.macro-note-list`

### Current layout behavior

- the ranking list is a vertical stack with spacing between cards
- each ranking row uses a 5-column CSS grid
- the suggestions area uses a 4-column card grid by default, overridden to 2 columns for the suggestions subsection
- cards are white with a light border and rounded corners
- the meter fill is a dark bar against a light track

### Current visual style

The tab currently reads as a fairly utilitarian analysis panel rather than a highly branded dashboard. Its visual vocabulary is:

- neutral panel backgrounds
- thin borders
- rounded corners
- compact typography
- minimal decorative flourish

## Current dependencies and assumptions

### Snapshot data completeness

The tab assumes the central bank snapshot pipeline has already resolved:

- current policy rate
- current inflation rate

If either is missing, that currency is excluded from ranking and suggestions.

### Currency universe

The tab is designed around the major 8 currencies only:

- USD
- EUR
- GBP
- JPY
- AUD
- CAD
- NZD
- CHF

### Country code availability

Flag rendering depends on `countryCode` from snapshots.

- if available, that code is used
- if not, the code falls back to the first two letters of the currency symbol

### Pair labels are not used here

This tab is currency-centric, not pair-centric. It does not currently use FX pair routing, ATR, event timing, or chart context.

## Current limitations

These are not bugs in this handoff, just the current state of the implementation:

- The tab presents a heuristic score, not a validated predictive model.
- Excluded currencies are omitted from scoring only when the data is unresolved, but the user-facing toggle row uses the same visual muted state concept, which can be easy to misread.
- The live ranking list is unaffected by the manual exclusion toggles, so the toggles only change suggestions.
- The suggestion engine is combinatorial, so the card count scales with the number of resolved currencies.
- The tab does not currently explain why one currency outranks another beyond the two sub-scores.
- The bar width and score scale are tied directly to the 0-10 normalization range.
- The current design is constrained by the shared `macro-*` class names, so changes here may affect other macro-oriented tabs if those classes are shared elsewhere.

## Relevant logic in the broader app

The strength meter tab is also used indirectly by higher-level overview logic:

- `getStrengthDifferentialSummary(...)` in [`Main/src/app/lib/overview.ts`](../../Main/src/app/lib/overview.ts) reuses the same ranking helpers
- overview specialist summaries include a `Strength Meter` card
- the overview verdict and routing logic reference strength spreads and decisiveness

That means changing the strength model will likely affect:

- the strength tab itself
- overview specialist summaries
- any downstream “strength decisive” behavior

## Suggested rewrite targets for a future redesign

If the next AI is planning a redesign, the most important current seams are:

- separate the currency ranking model from the presentation layer
- clarify the distinction between resolved-data exclusions and user-selected exclusions
- decide whether the tab should remain currency-centric or become pair-centric
- decide whether to keep the 60/40 heuristic or replace it
- decide whether the suggestions section should remain exhaustive or become curated

## Short version

The current Strength Meter tab is a three-part analysis view:

- a major-currency exclusion toolbar
- a ranked major-8 strength list built from 60/40 normalized rate/inflation scoring
- an exhaustive pair-suggestion grid sorted by score spread

It is visually clean and functional, but still narrow in interpretation and tightly coupled to the current macro snapshot heuristic.
