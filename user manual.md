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


## Volume and push comparison

1. Click **Volume** beside RSI in the chart header. Drag the divider to resize
   its pane. RSI and Volume can be shown independently.
2. Click **Raw** inside the pane to switch to **Relative**, or choose the mode
   through the Volume gear. For comparing intraday pushes, use Relative.
   **Show Relative activity line** in the Volume gear is on by default. It joins
   the exact Relative values for individual candles with straight segments: no
   averaging or smoothing is applied to the line, so spikes and dips remain intact.
   With Raw bars, the **left × scale** belongs to the line and the **right scale**
   shows tick counts. With Relative bars, both use the right × scale. The dashed
   **1×** reference means normal activity; the latest line value appears on its
   scale. Missing baselines have no line values, and nothing extends into future
   space. The optional raw tick average is separate and does not affect this line.

   Turn off **Show pane controls** in the Volume gear to hide Raw/Relative,
   Select A, Select B, Clear and Load older. The title and activity readout remain.
   Mode and both visibility options stay accessible through the header gear and
   are remembered on this device. Hidden controls cancel an unfinished A/B pick;
   existing selected ranges remain. Scroll left to load more history while the
   button strip is hidden, or turn it back on when needed.

3. Sessions are automatic. Hover a candle in the price chart or Volume pane to
   see its session. Overlaps appear together, such as **London + New York**.
   Move away from the chart to return to **now** and the current active sessions.
   Session times match the header and follow historical daylight saving; chart
   labels keep your display timezone. There is no Comparison clock setting.
4. Relative bars compare each candle with the mean of matching candles in up to
   **20 previous sessions**, requiring at least **5** earlier matches by default.
   Matching uses the same session combination and elapsed time within that period:
   London-only candles match London-only; London + New York candles match that
   overlap. Hovering changes only the readout, never the plotted bars' baseline.
   Multi-hour candles crossing boundaries match the same session mix; their ticks
   are not artificially split. D1 compares earlier broker daily bars.
5. If Relative shows a dash, **Load older** or scroll left to load baseline history.
   Only earlier available session occurrences are used, never the current one or
   future candles. Inactive periods and unknown broker clocks have no intraday
   baseline. Weekends show **No active session**. Broker holidays may differ from
   these indicative hours. If the loaded history has no candle covering now,
   the pane says **No current candle loaded** rather than presenting an older
   candle as current activity. Legacy clock preferences are ignored; your other
   volume settings stay saved.
6. Click **Select A**, then click the first and last candles of the first push
   **in the Volume pane**, aligned with the price candles. Repeat **Select B** for
   the second push. Endpoints are inclusive and may be selected in either order.
   A is highlighted blue and B amber in the Volume pane. Hover over the comparison
   text to verify the selected timestamps. **Esc** cancels an unfinished selection;
   **Clear** removes both. Enlarge the pane if you want more space for its readout.
7. Compare **average relative activity**. For example, A = 1.5× and B = 0.8× means
   the second push averaged less activity relative to its matching earlier sessions.
   **B vs A** reports that change and whether B reached a higher price high. These
   are descriptive measurements, with no entry, direction or reversal signal.

The comparison also reports closed-bar count, candle minutes (excluding market
closures and other gaps), and total ticks. Average relative activity gives each
closed candle equal weight, helping compare pushes of different lengths; total
ticks alone increases with duration. It is not the ratio of the pushes' total
volume. A relative comparison is shown only when every included candle in both
ranges has a valid baseline. The current unfinished candle is excluded from push
statistics, while its histogram and hover value continue updating. Missing tick
counts are unavailable; genuine reported zero ticks stay zero. Selections reset
when the broker, symbol or timeframe changes, and when Volume is hidden.

Use the same settings for both pushes, and select comparable
parts of each move consistently. A news-driven first push and a quiet second push
can differ for reasons beyond the price structure; session adjustment does not
remove news, holiday or unusual-day effects. Use your existing strategy for the
trade decision. Tick counts measure updates on this broker's feed, not lots traded.
Bar colours follow candle direction, not buy/sell volume. The optional SMA applies
to Raw ticks; Relative uses a 1× reference line. Settings are shared on this device.

## Currency Detail

Click **Detail** immediately right of Show events for fundamentals of the active
pair. EURX, JPYX and USDX show only their currency. Expand categories and metrics
for sources, reference periods, release stages and MT5 comparisons. Official
values lead verified conflicts; unverified data remains labeled. Last/next release
and verification clocks stay separate. Copy refresh prompt invokes no research
until you run it in the agent chat. The skill refreshes News and Detail together.
See [Currency Detail](docs/CURRENCY-DETAILS.md) for data rules and commands.
