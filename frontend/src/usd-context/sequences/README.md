# USD relationship snapshots / roofs v1

Implemented 7 October 2026 alongside `usd-context-memory-v6.2`. This layer
exposes existing rules and a separately labeled fresh-news experiment. It never
fits to candle direction, uses survey forecasts, or adds a second vote to the
accumulated engine. Standalone scorers and the existing context math are preserved.

## What qualifies

| Roof | Qualification | Direction shown |
| --- | --- | --- |
| Manufacturing + Services | Both included ISM sector publications are known for the same reference month | One existing ISM v3 resolution; own sector biases remain in details |
| Labor + inflation priority | Existing guarded labor-priority policy is active | Accumulated USD context at qualification |
| Claims challenge older NFP | Existing weekly-labor-priority policy is active | Accumulated USD context; preceding two Claims reports are confirmation only |
| Fresh-news sequence · Experimental | Net replacement changes agree across at least two economic domains within seven days | Sign of the recent replacement-effect sum, always Weak evidence |

Snapshot identities retain kind, qualification clock and source IDs. New inputs
can produce another dated snapshot; unchanged membership does not emit one every
broker midnight. They are update annotations, not mutually independent statistical
episodes. Policy qualification can occur at an aging boundary as well as a new
publication. Sources never postdate the snapshot.

## Fresh news is a change, not a source label

For each publication, compare its score with the eligible score it replaced:

`change = base family weight / 100 × (new total × new coverage − old total × old retention × old coverage)`.

The old score is evaluated immediately before the update; the new score has its
age reset. Fixed base weights on both sides exclude conditional policy transfers
from the experimental change. The recent change can include that age reset and
coverage change: it is not an isolated measurement of economic acceleration.
When no eligible predecessor exists, compare against zero and show the original
source. An uncomputed new publication replaces the old fresh slot with a zero
change; it does not turn missing information into a directional vote.

Keep only the latest update per family; do not sum several overlapping Claims
reports. Drop it exactly seven elapsed broker-clock days after publication, even
between precomputed stages. Unchanged GDP can accompany a roof as **No directional
update** and contributes zero. Opposing PCE/other inputs remain visible.

Inflation = CPI/PCE/PPI; labor = NFP/Claims; activity = ISM/Retail/GDP. Sum changes
within each domain first. At least two domain nets must agree with the overall
direction before drawing a fresh roof. Two inflation reports, or NFP plus Claims,
cannot alone qualify as two domains. Exact cancellation follows the existing
family priority with Weak evidence. No nonzero change stays Uncomputed.

The seven-day window, budgets and domain grouping are declared prototype rules,
not fitted optimal parameters or statistically independent evidence. The
experimental result can oppose older accumulated context. It is available in
the gear, and in dashed roof details; the main box retains accumulated context.
The optional EUR/USD relative result remains a separate selected view.

## Ownership and performance

- `core/`: typed snapshots, single-pass derivation and binary fresh lookup.
- `chart/`: containing-candle projection, visible-range lookup, three-lane layout,
  overflow access and animation-frame-coalesced subscriptions.
- `ui/`: flat Inspector details, gear comparison and display controls.
- `storage/`: validated, portable, cross-window display preferences.

The existing shared background job builds sequence metadata once with the USD
timeline. Source settings/family changes invalidate the versioned job normally.
Opening the gear, clicking a roof, hovering or panning does not rescore history.
The two display controls require no new calculation. Context snapshots share
existing point results; they do not copy the full calendar or price history.

## Auditing

Open Raycaster, enable desired context inputs and Inspector markers/date range,
then click a roof. Read its known-by clock, source roles, standalone outputs and
before/after result. Open any source to inspect its actual readings. Record H1
release-candle reaction separately from later 4/24-bar reactions; a delayed rally
is not evidence that the initial release interpretation caused it.

The fixture suites test atomic updates, future removal, domain overlap, seven-day
expiry, unavailable updates, ISM pending sectors, confirmation-only Claims,
containing-bar geometry, cutoff/hidden filters, crowded access, coalesced panning,
source navigation and preference portability. `scripts/usd-context/audit-sequences.mjs`
compares every accumulated point with the committed builder and replays dated
roofs with future rows physically removed. The user performs visual UI checks.

Not implemented: PCE income/spending sub-context, generalized new interaction
weights, automatic price-audit labeling or a historical volatility detector.
These remain research tracks; this layer makes existing relationships reviewable.
