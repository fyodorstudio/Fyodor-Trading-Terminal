# Currency Ledger

Owner: `frontend/src/currency-ledger/`, `storage/currency_ledger.py`. Exact
numerical identities, units and publisher routes come from
`config/currency-details.json`. All eight major currencies and all 28 FX pairs
are supported, including recognized broker suffixes. Indices keep their existing
Detail. `storage/ledger_catalog.py` adds every captured broker series using the
shared exact-ID catalog; it never replaces an unavailable canonical measure with
an approximate series. `storage/ledger_vintages.py` owns retained capture clocks.

## Interaction

**Ledger** opens a resizable bottom dock with a chronological horizontal date
tape and the selected pair's two event lanes. Load one complete calendar year (January 1 through
December 31) plus three older retained actuals per measure for carry-forward
and the header's cross-year history.
Drag the tape horizontally to browse; pointer moves are batched per animation
frame and a drag suppresses the card/date click. A thick native scrollbar remains
available. At the year boundary a small Go to YEAR prompt opens the adjacent year:
previous lands in December, next lands in January. Supported years start in 2015
and end in the current Jakarta year; empty local history stays empty.

Dragging and year browsing never change the evaluation cutoff. The date selector
sits beside ⌖ and Today, above the category header. Today returns to the current date
and year. Year selection is independent of the evaluated date: the score's year
is retained while another year is viewed, avoiding a silent change of verdict.
The timeline mounts only viewport dates plus three days of overscan on either
side. Height-only resizes do not recreate the shared context or repaint the tape.
Cells grow with dock height and scroll vertically when needed. Busy cells mount
only visible cards plus two cards of overscan per edge, so hundreds of same-day
releases do not create hundreds of DOM nodes. Height changes update these small
windows without rebuilding the tape or chart.

Select a date for 11:59:59 PM Jakarta, capped at the present for today.
Captured corrections use their capture instant. Today resumes the current clock.
The tape is a complete record browser: already released values stay visible even
when they are after the selected evaluation date. Its actuals use the latest
retained capture; it does not claim to replay an original release vintage. The
header and scorecard alone evaluate the cutoff. Premature actuals for genuinely
future publications are suppressed by the server; scheduled events add no points. All selected
dates and category contributions use the same cutoff for both currencies.

The fixed header has Interest rate, Inflation, Labour & wage and Activity selectors.
Each shows the latest three releases available by the evaluation cutoff,
oldest left and newest right, with Actual/Forecast/Previous and each currency's own
date. Forecast belongs to that release. Missing values stay dashes. The header
keeps its own horizontal scroll independent of the daily tape. One pinned currency
column avoids repeated currency labels; clicking a currency opens **Fundamental
Detail** in the existing right panel. Numeric score boxes are absent from the
header. Selectors affect display only, leaving scoring contributions unchanged.
Comparable presets retain each country's actual definition, including HICP,
CPI-trim/median, quarterly CPI and national PMI surveys. Measures unavailable for
the other currency remain blank. Additional per-currency selector options expose
all stored series, including PPI, speeches, fiscal/trade/housing data and valid
unknown IDs. These options change display, not the scoring formula.
The scorecard compares each currency with its own previous reading,
shows per-category advantage and expands the selected currency/category evidence.
Each measure retains its latest available reference period until superseded.
Revisions to older reference periods do not replace newer periods. Reading,
reference period, release time, retained capture, previous, historical consensus
and publisher route remain inspectable. Scorecard evidence opens the exact
release in Inspector and never changes a bell.

Clicking a header or tape release opens its exact source package in Inspector,
highlights the measure, and leaves the Ledger cutoff unchanged. This transient
focus works outside the Inspector date window and when a family is hidden,
including By day, without changing saved filters/grouping or chart markers.
Inspector shows the latest retained raw broker values, which can include later
revisions. Return to Ledger restores the selected year, date, selectors, header
scroll and tape position. Event inspection itself never changes reminders.

Actual numerical text uses the broker's stored MT5 `impact`: positive green,
negative red, none/unknown neutral. Forecast, previous and card backgrounds remain
neutral. This is the feed's assessment, independent of the provisional score;
it is not inferred from Actual−Forecast or Actual−Previous. Missing actuals are
never colored, and zero is a valid colored actual.

Rate decisions (the evaluated calendar year, newest first) and Tier List Info
remain available in Detail. Historical rate values obey the same capture cutoff. News, alarms,
Inspector family choices, chart dates and drawings are independent. Historical
selection persists when switching docks in this session; reload starts Today.

The ⌖ (U+2316) button immediately left of Today arms a one-use candle picker.
It listens to native chart clicks without covering the canvas, preserving native
crosshair movement, dashed lines and the x-axis date label.
Click an actual price-pane candle to jump Ledger to its Jakarta date at day end
(today is capped at now), using that broker's historical clock profile. Indicator
panes, axes and blank/future chart space do not select a date. Picking turns off
after a valid selection; Escape, Today, a second cursor click, closing Ledger or
changing broker/symbol/timeframe/tool cancels it. Unknown broker clocks disable
the picker. The chart viewport, drawings and event/reminder selections are unchanged.

## Provisional formula v1

This is a **momentum score /100**, not a percentage likelihood, validated currency
forecast, or full economy-health score. Each scoring measure compares its actual
with its own captured revised previous value, otherwise captured previous value:
favorable change = 100; unchanged = 50; unfavorable change = 0. Missing actual or
previous excludes that measure; zero is valid. Magnitudes and forecast surprises
do not affect this initial formula.

| Category | Scoring measures | Favorable under this proxy |
| --- | --- | --- |
| Rates | Each currency's defined policy rate (Fed upper bound for USD) | Increased |
| Labor | Unemployment; payroll/employment change where mapped | Lower unemployment; increased jobs change |
| Growth | Each country's quarterly GDP definition | Increased growth rate |
| Demand | National retail sales or household spending series | Increased growth rate |
| Inflation | Headline/core CPI, US core PCE, Canadian trim/median | Context only: heating/cooling |

Within each category, average available scoring measures. Average available
category scores with equal category weights. Show measure coverage and categories
assessed out of four. Missing evidence never becomes a neutral 50. Categories
with equal scores say Balanced; either missing says Unassessed. Category advantage
compares momentum scores, not raw national unemployment or growth levels.

Wages, PMIs, monthly GDP, US retail control and additional raw calendar series
are context only. CAD/GBP use `gdp-quarter`, other currencies use `gdp`;
demand uses canonical `retail` or `spending`. National growth rates are not
converted into comparable magnitudes: only each series' direction earns points.
EUR/GBP/CHF/JPY have unemployment as their mapped labor scoring measure;
USD/CAD/AUD/NZD also have payroll/employment change. Coverage exposes these
unequal information sets. Unmapped Australian monthly CPI/trimmed mean and
spending remain unavailable rather than borrowing legacy quarterly measures.
External conditions, policy guidance and market rate expectations are not yet
scored. Inflation needs an agreed regime interpretation before contributing.
These omissions and the coarse directional formula limit any trading inference.
New releases replace contributions; repeated stories/captures never add points.

## Historical evidence

Local calendar history is not necessarily the publisher's original release
vintage. An import may already contain revisions. After the release clock, use
the earliest retained actual if nothing was captured by the cutoff and mark it
backfilled. Later corrections only apply after capture; their publisher correction
hour is not invented. There is no exclude-later-captures mode or mode selector.
This remains an exploratory reconstruction, not a clean historical backtest.

Preserve independent publication and capture clocks. Date-only
publications never acquire an hour. Premature future actuals are suppressed by the server.
Only retained broker observations are scored; current official Detail values
are never projected backwards into history. Publisher links provide provenance
routes, not a claim that broker values were independently verified.

## Delivery and verification

GET `/api/v1/currency-ledger?source_id=Pepperstone-Demo&scope=EURJPY&year=2026`
returns schema 1, calendar-year bounds, supported year limits, requested currency
metric definitions, source availability, per-currency coverage gaps and retained
capture entries. Scope accepts the shared currency/pair/index/ALL resolver;
omitted scope remains USDCAD for compatibility. The UI requests only its pair.
Omitted year defaults to the current Jakarta year; unsupported
years return 422. `after_revision` supports year-specific unchanged responses.
One bounded `events_ledger_range` seek per currency discovers all yearly series.
Each admitted series gets one indexed pre-year seek for up to three retained
actuals. Observation reads are batched in groups of 400 value IDs, not issued per
reading. Currency/year snapshots share a bounded 16-entry server cache across
pairs. The cache invalidates on data revision or the next retained capture/future
publication boundary or a coverage expiry; unchanged polls do not reread/redecode histories. All-eight
observation changes advance the revision, even when source priority preserves the
current payload. Response digests combine cached currency digests without walking
entries on unchanged requests. No whole-archive scan, research, save, reminder
change or raw mutation occurs.

The shared Ledger provider polls viewed/evaluated years every 30 seconds only
while supported Detail or Ledger is open, with a four-snapshot cache. Year/pair/broker
changes abort stale requests; errors retain only same-broker/scope data. Scrolling performs
no fetches or score recomputation. Clock updates remain
inside the provider and do not drive chart rendering. Terminal tests cover real
storage-to-UI validation for all 28 pairs, complete series admission, carry-forward,
exact cutoffs, vintage isolation, score replacement, missing coverage, MT5 impact,
1,000-event cell virtualization, shared cache/index work counts, assembled-terminal
resize/scroll regressions and cleanup. Visual acceptance
stays with the user.
