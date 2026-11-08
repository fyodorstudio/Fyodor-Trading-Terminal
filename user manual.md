# Research workflows

For the usual refresher, open Currency News, choose All or a currency, and Copy
refresh prompt. Paste it into your agent chat. The agent prioritizes the newest
material developments, checks sources and saves the researched currencies.
There is no fixed lookback cutoff. Reload saved news only reloads local results.
A plain `$assess-trade-now` also reviews global ongoing risks and seven days ahead,
prioritizing 48 hours. It maintains sourced global custom stars/notices and new
verified high-impact reminders, respecting off choices, pause and lead time.
These risks appear across pairs and supported currency indices, with separate
currency implications. Unpredictable updates receive an ongoing notice; uncertain
hours never receive a fabricated alarm. See [global risk discovery](docs/GLOBAL-RISK-WORKFLOW.md).

The date revolver opens on Today and filters stories by publication date in
Jakarta. An older headline discovered today belongs to its original date.
Date-only stories show that date and an Assessed age, using last assessment time
for ordering. A wholly undated story uses the assessment date too. This does not
claim the story was just published. A single Last updated age shows when saved
content for the selected date last changed.

The feed has currency tags and sources, News Fundamentals, and Implication.
Shared stories appear once. Source facts stay in News Fundamentals; agent
reasoning and coverage caveats stay in Implication. Bias is bullish/bearish when
supported, or explicit bullish-if/bearish-if scenarios when mechanisms compete.
No direction is forced. Material follow-ups get their own dated rows.

All/currency buttons reuse the same records without running research. Scroll or
Show more news to load further rows. Where multiple assessments exist, select an
earlier one inside Implication; other currency views and story ordering stay
unchanged. Today alone offers the live refresh prompt and polls saved results.
Past/future dates are browsing only. Export Markdown downloads the selected date,
currencies and assessments, including rows beyond the current scroll batch.
History is local ignored data included in storage backups.

Examples:

- `Use $assess-trade-now to refresh all eight currencies, prioritizing the freshest news.`
- `Use $assess-trade-now for fresh CAD news and relevant policy context.`
- `Use $assess-trade-now for USD news, chat only, no save.`

A currency implication is conditional pressure, not a trade instruction or
strength against every peer. A failed source route is not proof of no news.

| Optional skill | Use |
| --- | --- |
| [One Minute Before Release](.agents/skills/one-minute-before-release/SKILL.md) | Wait in this chat for a named imminent release, verify fresh actuals, then interpret the relevant currency. |
| [Review Historical Research](.agents/skills/review-historical-research/SKILL.md) | Investigate a named historical move using a date-range brief, calendar, dated news and H1/H4 candles. |

Currency News saves do not change reminders; the skill's separate risk review
curates them. The agent leaves technical levels, entries and chart scans to you,
including when you mention JPYX/USDX resistance or reversal. Calendar
Alert bells, manual price alerts, Entry Trade and chart drawings stay independent.
The [news contract](docs/CURRENCY-NEWS.md) owns persistence and timing.
[Short research rules](docs/RESEARCH-RULES.md) and focused reviewed lessons retain
prior failure context; full original records are [archived](docs/RESEARCH-ARCHIVE.md).


## MFDI

Select **USDX**, then click **MFDI** beside Volume and RSI. MFDI means Macro
Factor Data Inspector. Drag its pane divider to resize it. This adds or removes
canvas space below while preserving the lines' vertical position and zoom.
Five compact controls
appear in this order: **Fed Rate (%)**, **Payroll (k)**, **Unemployment (%)**,
**Headline CPI m/m (%)**, **Core CPI m/m (%)**. A filled circle before each box
matches that line's colour, including changes made in Style.

- Click a **label** to select its draggable right axis. Selecting a hidden
  line reveals only that line.
- Click its **grey eye** to hide/show just that line. A slashed eye means hidden.
  The five controls remain available when every line is hidden.
- Click **F** to show/hide that series' forecasts. A slashed F means hidden.
  Payroll forecasts start on; the other four start off. Each choice is saved.
  The series eye also hides its forecasts without changing its F choice.
- Click **N** beside F to show values above that series' actual release dots.
  A slashed N means hidden (the default). The choice is saved per series;
  hiding the series or its dots also hides the numbers.
  Numbers start with ↑ for an increase or ↓ for a decrease from the previous
  available release. First readings and equal values have no arrow.
- Fed Rate uses the target upper bound and a step line between decisions.
  Payrolls, unemployment and CPI use lines with dots at actual releases.
  CPI values are monthly changes, not annual inflation.

Click a **dot on a plotted line** to open the exact release package in the
Inspector bottom dock, with the clicked measure highlighted. Its companion
readings remain visible. Inspector's saved filters and date range stay unchanged;
the source value ID identifies the release even when it is outside that range.
Connecting segments, carried Fed-rate values and hidden dots do not open releases.

Hover a **Fed release dot** to see consensus values only. A short vertical dashed
connector joins the actual to Investing.com's consensus, with an end cap at the
forecast. A higher-than-consensus actual has an outline. Hovering never changes
zoom or placement; offscreen forecast values remain readable in the tooltip.
CME probability and retrieval/backfill text are omitted.

The supplied table covers January 2020 through October 2026, with 54 consensus
values across 56 decisions. The March 2020 emergency decisions have no forecasts
in the source. See the [Fed consensus reference](docs/MFDI-FORECASTS.md).

Upcoming releases appear as **dashed vertical lines** in the pane's empty future
area. Only verified exact-time schedules for visible series appear, within the
existing 90-day future axis. CPI or jobs companions scheduled together share one
line. Date-only/unverified times stay unplaced. These lines read the stored
calendar and do not change reminders or imply an upcoming actual value.

Forecasts form their own line, joining forecast values rather than actuals. The
historical line uses the same colour at 60% opacity; hollow forecast rings are
slightly larger than actual dots, so equal values remain visible. Upcoming
forecasts continue from the last forecast with a dashed line and rings at 40%
opacity. An upcoming release without a forecast keeps only its vertical schedule
line and breaks that connection. Zero is a valid forecast. The existing dots
setting also controls forecast rings; forecasts never resize the scales.

Each scale keeps its own zoom and placement while you
scroll dates, load older history, switch axes or toggle eyes. **Fit axis**
(or double-clicking the right axis) fits only the selected scale to visible data,
then holds the new bounds. Values outside those bounds can remain offscreen until
you resize or refit that scale. Both CPI lines always share the Inflation scale. Equal screen heights across different
scales do not imply equal magnitudes. Hiding the final visible line on the selected scale moves the right axis
to another visible series when available.

The gear opens **Inputs | Style**. Inputs chooses individual series
and the right axis. Style changes colours, line widths, dots and forecast visibility for every line,
including Payrolls. **OK** saves,
**Cancel** discards the draft, and **Reset defaults** resets the draft.
Preferences persist. Previous MFDI styles and enabled state are retained. Former
category hides migrate to each line's eye state, so revealing one line does not
unexpectedly reveal a sibling.

Hover a candle to see the latest known actual and its release date in your
display timezone. Monthly lines connect only actual release points; carried
readouts do not create extra dots. Points align to the containing
candle; if multiple releases share a candle, the latest actual wins. Scroll
left for more released points. Only captured releases with verified MT5 timing
appear, using the latest stored vintage and saved official Fed values where available.
Forecasts use the captured calendar Forecast field, with saved Investing.com
consensus preferred at exact matching Fed releases; a blank saved consensus stays
blank. Forecasts use the latest stored vintage. Future releases never supply actual points.
MFDI has no composite index or dispersion calculation. Switching away
from USDX hides the pane; returning restores it. Click **MFDI** to hide it.

## Volume

1. Click **Volume** beside RSI in the chart header. Drag the divider to resize
   its pane. RSI and Volume can be shown independently.
2. The pane controls are **Axis: Volume / Relative**, then
   **Bars**, **Relative**, **Average**. The last three buttons independently
   show/hide the histogram, exact Relative line and raw-tick SMA. Their pressed
   states show which layers are visible. All controls remain available with
   every layer hidden. The Average applies in Raw mode and is disabled in
   Relative mode. Visibility persists across symbols/reloads and matches the
   Volume gear's **Style** tab. Use **Inputs** for average length and baseline
   settings, including choosing Raw or Relative mode.
3. In Raw mode, the axis button chooses which visible series the right axis
   resizes; the other uses an independent hidden automatic scale. When only
   one kind remains visible, the axis follows it. Relative bars and the Relative
   line share the right × scale. In Raw mode, clicking the axis selector reveals
   the chosen layer if hidden. Choose bar mode through **Inputs → Mode**.
   Double-click the right axis to restore automatic
   scaling. The Relative line joins exact candle values without smoothing, stays
   above the bars and has a dashed **1×** reference for normal activity. The
   optional raw average does not smooth this Relative line.
4. The upper-right readout keeps stable fields:
   `| Ticks 13,261 | Relative 0.90x | Matches 19/20 |`.
   All four session names stay visible below it: active names are red, inactive
   names grey. Hover follows the selected candle; leaving hover returns to now.
   Sessions match the header's indicative regional hours, including overlaps
   and historical daylight saving. Both indicator legends have transparent
   backgrounds behind their text. Broker holidays may differ.
5. Relative activity compares a candle with matching candles in up to **20 prior
   sessions**, requiring at least **5** matches by default. Matching uses the same
   session combination and elapsed time within that period. Multi-hour candles
   match the same session mix without splitting ticks. D1 uses earlier broker
   daily bars. Hovering never changes the plotted baseline. If Relative is a
   dash, scroll left to load earlier history. Future candles and the current
   session never enter their own baseline. Unknown broker clocks stay unavailable.
6. Readouts keep genuine zero ticks as zero. Missing counts remain unavailable.
   Without a loaded candle covering now, the readout says **No current candle
   loaded**. Tick counts measure updates on this broker's feed, not lots traded.
   Bar colours follow candle direction, not buy/sell volume. No entry, direction
   or reversal signal is generated.

## Currency Detail

Click **Detail** beside Show events for S/A/B/C fundamentals of the active pair.
EURX, JPYX and USDX show only their currency. Full-width tier subheaders group
equal-width currency columns. Equal-height event blocks contain the
Previous reading, Latest actual and Next upcoming forecast in labelled cells,
then Released at, Next Release and the original Source link. Missing values show
a dash; the forecast is for the next release, not old consensus. Hover ⚠ for a numeric
conflict. Tier List Info shows the general reference and your active currencies'
tier table; its Close button returns to the comparison. Alert uses the same tiers.
Copy refresh prompt runs no research until invoked in the agent chat; the skill
refreshes News and Detail together. See [Currency Detail](docs/CURRENCY-DETAILS.md).
