# Manual audit backlog

Updated 7 October 2026. Checkboxes mean **your manual audit**, not automated tests.
Your reported reviews of earlier versions are retained below; they do not certify
later changes. Items stay open unless you explicitly reported completing them.
Terminal tests/builds and chronology replays do not substitute for visual or
economic interpretation review. Use the current scoring library for rule details.

## How to record findings

For each sample record: broker, publication date/time, H1 timeframe, scorer/version,
selected context mode and enabled inputs, standalone bias/evidence, publication
context bias/evidence, roof/fresh-news result if present, and price reaction.
Keep the release candle separate from subsequent 4/24 trading bars and week-long
moves. Record gaps, later releases, incomplete history and revised data. A price
disagreement is an investigation finding, not proof of its cause or a fitted rule.

## Standalone USD interpretations

| Family | What you already reported | Still pending |
| --- | --- | --- |
| CPI v3.1 / v4 | Several 2025–26 samples; August/September 2025 disagreements; positive reports after refinements | Broad review of current rules, limited-data cases, publication context and latest layout |
| NFP v2 | Weak August 2026 report identified; other spot checks | Broad current-version audit, hiring/unemployment/wages conflicts, revisions and participation qualifiers |
| Claims v2 | Small March 2025 review, generally favorable | Weekly trend conflicts, nonoverlapping trend interpretation, confirmation break/recovery and current context integration |
| ISM v3 | Services samples November 2025–September 2026; original failures identified | Current grouped Manufacturing/Services resolution, opposing sectors, pending Services and separate original publication clocks |
| Retail Sales v1 | April–September 2026 samples; generally favorable | July 16/May 14 Long-versus-falling-price findings, evidence grades and broader coverage |
| PCE v1 | February 28, 2025 discussed as an opposing small Short | Broad standalone audit, monthly/annual conflict and incomplete readings |
| GDP v1 | December 23, 2025 Short; February 27, 2025 Uncomputed noted | Estimate versus revision behavior, unchanged growth, consumption/final-sales conflicts and broader coverage |
| PPI v1 | No completed dedicated manual audit reported | Core/headline conflict, monthly/annual weighting and broader coverage |
| Fed decision context v2 | Multiple 2025–26 decisions reviewed; favorable examples and failures reported | Recheck current interpretation/previous-meeting comparisons after later refinements; verify holds have no standalone directional vote |

- [ ] Check CPI automatic and custom signal magnitudes against visible Scatter values.
- [ ] Recheck incomplete CPI readings (December 2025–March 2026 examples previously
  Uncomputed), rather than treating missing monthly evidence as a fresh cool reading.
- [ ] Recheck payroll revised-previous labels/deltas, including December 16, 2025;
  distinguish original supplied Previous from revised comparison and units.
- [ ] Check Claims initial versus continuing trends, disagreeing components,
  isolated weekly spikes and missing/ambiguous preceding reports.
- [ ] Check ISM sector disagreement: one resolved family vote, not two full votes.
- [ ] Check Retail control group versus headline and gasoline/auto effects; do not
  assume Strong evidence predicts a larger candle than Moderate evidence.
- [ ] Review GDP first estimates, same-quarter revisions and zero changes separately.
- [ ] Review PCE/PPI independently before evaluating their context contributions.
- [ ] Recheck Fed April 30 / March 19, 2026; October 30 / September 18 / July 31 /
  June 19 / May 8 / March 20, 2025 findings. Record initial reaction separately
  from delayed reversals; August 1 NFP is a later release, not Fed guidance.

## USD context / Raycaster

You reported that Raycaster improved and needed more audit time. The following
are therefore pending on the current engine, not a claim that nothing was reviewed.

- [ ] Check all eight default source budgets and each displayed contribution,
  including assigned weight, age retention and component coverage.
- [ ] Check the guarded labor–inflation priority enters/exits only when its listed
  conditions pass; hotter or unavailable inflation must not keep an old rule active.
- [ ] Check weekly Claims priority against an aging Weak/incomplete NFP; preceding
  two reports confirm but do not add votes, and priority transfers do not stack.
- [ ] Check latest missing reports replace old family assessments; expired and Off
  inputs do not have their weight redistributed.
- [ ] Check broker-midnight aging updates, exact hard expiries and a new report's
  age reset; do not confuse Memory update with a new economic publication.
- [ ] Check Weak/Moderate/Strong explanations against component agreement,
  incomplete coverage and within-labor conflict; they are not probabilities.
- [ ] Check input filters remain independent of Inspector symbols/date range and
  shared with publication-context views. All-Off must stay Uncomputed.
- [ ] Revisit December 23, 2025–January 9, 2026 and January 9–28, 2026, where
  old Raycaster output disagreed with your price observations.
- [ ] Revisit June 17–18, 2026 and August/September 2025 CPI context disagreements.
- [ ] Compare Raycaster at an exact publication cutoff with Inspector; an H1
  candle-end lookup can include another release later inside that same candle.

## EUR menu and relative EUR/USD

No completed broad manual EUR/relative audit has been reported.

- [ ] Euro-area inflation and German CPI/HICP: aggregate anchors the month;
  German proxy is partial and is replaced rather than counted again.
- [ ] Euro-area, German and French PMIs: early country proxies, overlapping
  activity slots, composite versus sector readings, flash/final replacement.
- [ ] Euro-area employment/unemployment: separate monthly/quarterly timing,
  opposing readings and unavailable replacements.
- [ ] Euro-area wages/labor costs and GDP: quarterly cadence, lagged information,
  revisions, incomplete components and retained influence.
- [ ] ECB numerical rate actions/holds: overlapping rates are not three votes;
  statements, conferences and speeches remain unscored text.
- [ ] Relative EUR/USD: both currencies' budgets, normalization, contribution
  subtraction, proxy dependence and evidence cap; verify the selected mode label.
- [ ] Check EUR expiry/aging independently of USD and ensure later aggregate/final
  publications are absent at earlier publication clocks.
- [ ] Compare USD-only versus EUR-vs-USD on the same dates and input settings,
  retaining disagreements rather than assuming USD alone caused the movement.

## Clickable roofs / fresh-news experiment — newly added, not audited yet

- [ ] Inspect ISM sectors, labor–inflation, weekly-labor and dashed fresh-news roofs.
- [ ] Click a roof: review known-by time, participating sources, roles, conditions,
  standalone directions and accumulated context before/after.
- [ ] Click every participating source, including either grouped ISM sector; verify
  the correct broker date and original readings open in Inspector.
- [ ] Check a prior candle excludes later endpoints, even when the historical chart
  displays a later dated annotation. Check gaps and no future-candle projection.
- [ ] Check same-time GDP/Claims form one update; unchanged GDP is a zero companion.
- [ ] Check fresh news keeps only the latest update per family within seven days,
  expires exactly at the boundary and does not stack overlapping Claims reports.
- [ ] Check a still-Long replacement can increase USD support when less negative
  than its predecessor; standalone direction and replacement effect are distinct.
- [ ] Check at least two agreeing economic domains qualify a fresh roof; two
  inflation families or NFP/Claims alone are not independent domains.
- [ ] Compare March 3/5/7, 2025 fresh Weak Long with accumulated memory; opposing
  PCE stays visible, GDP does not vote, and earlier price gains precede ISM.
- [ ] Check hidden marker counts, all-hidden omission, crowded three-lane overflow,
  pan/zoom/resize, pointer access and ordinary drawing interaction.
- [ ] Check roof/fresh display toggles, Raycaster hide/show, captured Inspector
  snapshots after settings changes, and broker/symbol changes.

Roof counts are overlapping dated updates, not independently validated setups or
proof of historically high volatility. Fresh-news comparison remains Experimental
/ Weak and is separate from the accumulated main result.

## UI / settings / repository changes

- [ ] Check named fresh-news roofs (for example **Claims + PCE · Long**), full
  release names/effects on hover, repeated-family deduplication and `+N` overflow.
  Zero-change companions stay in details; opposing drivers stay named. Direction
  remains visible when the name needs truncation.
- [ ] Review this pass's flat Inspector blocks: result first, **What drove the
  result**, supporting/level context, **How this scorer works**, **Calibration &
  settings**, and **Coverage & limits**. Read both currency-context tables and
  the active-relationship conditions without opening collapsible controls.
- [ ] Check these blocks in short/tall docks, narrow widths and light/dark themes.
  Confirm custom magnitude labels, units, missing-history notices and input
  toggles remain readable; visual audit is still pending with the user.

- [ ] Audit this pass's consistent left **Standalone Scoring** / right
  **Context-Aware at Publication Scoring** across every selectable scoring view.
- [ ] Check long USD vote/retention text stays inside its table column; no overlap
  into adjacent EUR/relative tables and no height-dependent horizontal scroll.
- [ ] Check narrow widths stack the two sections in the same reading order.
- [ ] Check Fed hold's standalone action stays distinct from its contextual bias.
- [ ] Check the organized flat Raycaster gear: headings, conditions, input toggles,
  selected context mode, explanations, Escape/outside close and held-candle label.
- [ ] Check shared/manual Scatter magnitude preview/apply/reset and isolation between
  family settings; a boundary edit updates the intended scorer and shared context.
- [ ] Check Inspector grouped ISM filter and table sections; no duplicate symbols.
- [ ] Check workspace export/import restores family, magnitude, relative, roof,
  Raycaster visibility/position and Inspector settings.
- [ ] Check historical event selection, other brokers/symbols/timeframes, stale
  results during loading and disclosed partial/unavailable history.
- [ ] Check responsive chart panning with Inspector/Scatter/Raycaster/roofs open
  after the recent hygiene/refactor; automated parity is not a visual audit.

## Deferred work — not an audit of implemented features

PCE income/spending demand companions, further regime/interaction research,
automatic fixed-window price-audit tooling and a validated volatility detector
are not implemented. Transcripts, geopolitical feeds and survey forecasts remain
outside the authorized numerical dataset scope. The proposed research list is
a roadmap, not a list of completed combo scorers.

References: [scoring library](scoring%20system%20library.MD),
[roof implementation audit](reports/Context-sequence-implementation-audit.md),
[February–March research](reports/Feb-Mar-2025-release-sequence-audit.md).

## 7 October 2026 — Latest-only scoring cleanup

The older comparison screens listed in historical audit notes are retired. Audit
the current replacement views; earlier price/context findings remain unresolved
unless separately recorded as audited.

- [ ] Check the Inspector menu has Table only, one versioned Scoring option and
  Scatter Plot for CPI, NFP, ISM, Claims, Fed, PCE, Retail, GDP/PPI and EUR/ECB.
- [ ] Check CPI is labeled v4 in Inspector and Raycaster; its details identify the
  unchanged standalone engine v3.1 without adding another selectable CPI mode.
- [ ] Check ISM shows one v3 final output and both sector sections, preserving
  original publication clocks and pending later Services at earlier selections.
- [ ] Import an older workspace with scoring-v2/v3/v4 selected: it should open
  the current scorer and preserve magnitude overrides, filters and chart settings.
- [ ] Check current Scatter/raw A−P views still work; latest scoring no longer
  loads the raw-magnitude history merely to show a deleted comparison screen.
- [ ] Check short/tall/narrow docks, both themes and chart responsiveness. Visual
  inspection is left to the user; terminal checks do not mark these boxes done.

Retired formulas and replacement rationale:
[Retired scoring systems](reports/Retired-scoring-systems.md).

## 7 October 2026 — Responsiveness refactor

- [ ] Pan and zoom repeatedly with a long history while ISM, CPI and Fed scoring
  are open, with Raycaster/roofs visible. Check for the former periodic pause.
- [ ] Scroll both scoring columns in short/tall/narrow docks and both themes.
  Confirm one shared scroll region, no overlapping sticky headings and readable
  contribution/calibration tables.
- [ ] Leave live candles running while scrolling: bias/details should remain
  stable until their actual inputs change. Check new candles, chart gaps, range
  changes and future symbols still align with the correct candle.
- [ ] Check existing/new drawings follow panning, resizing and live price-scale
  changes. Check editing, selection and deleting still work.
- [ ] Switch releases, families, brokers and magnitude settings; verify no stale
  scorer or histogram survives a meaningful input change, and roofs remain clickable.

Terminal operation-count checks are documented in
[Responsiveness refactor](reports/Responsiveness-refactor.md). These boxes remain
unchecked: automated tests do not verify perceived scrolling or frame rate.

## 7 October 2026 — Result-first scoring layout

- [ ] Check every current scorer shows its bias and evidence immediately below
  the column heading, with both result boxes starting at the same height.
- [ ] Check CPI, NFP, Claims, ISM, Retail, PCE, GDP/PPI and EUR/ECB keep visible
  version notes below the result, followed by their explanations and tables.
- [ ] Switch USD side / EUR vs USD: the context result should remain first, with
  one cutoff/view control row below it. Check CPI publication changes and Fed
  previous-meeting details remain available.
- [ ] Check loading, missing-history and Fed-hold states, short/narrow docks and
  both themes. Confirm wrapping is readable and the shared scroll region still
  pans/scrolls smoothly. Use toggles retain their current calculation behavior.

## 7 October 2026 — Advanced input settings and shared bottom dock

- [ ] In Inspector and Raycaster, check USD/EUR contribution tables show read-only
  Enabled/Off status. Open Advanced settings to edit inputs; close it again and
  confirm the table status and calculated result still reflect the saved choices.
- [ ] Check Advanced settings in both themes and a narrow dock/popover. Versions,
  publication cutoffs and interpretation rules should remain unchanged.
- [ ] Use the bottom status buttons to switch between Notebook, Activity,
  Inspector, Scatter Plot and Alert, and click the active button to close/reopen.
  Check the duplicated top tabs, maximize/minimize button and X are gone.
- [ ] Resize any dock, then switch through the others and reload the app. All
  should share that height. Check dragging and Arrow Up/Down, Home/End on the
  resize handle; small viewports should clamp without overwriting the preference.
- [ ] Export/import the workspace and verify the shared height travels with it.
  Older per-dock heights migrate once, preferring the initially active dock's
  saved size when available. Check chart panning and Activity Checking remain smooth.

## 7 October 2026 — Live right-side filters and bottom calendar

- [ ] Open Filters: check the panel fills the right edge from top to bottom,
  with no background blur or dimming. Check both themes and small viewports.
- [ ] Tick/untick Select all for Base and Quote. Check it includes hidden search
  results and both grouped ISM source families, without changing the other side.
- [ ] Check family/symbol/color changes update the chart immediately. Save should
  preserve them after refresh. X/Escape keep unsaved session edits; Cancel rolls
  back to the choices from when the panel opened. Check restored focus.
- [ ] Pan/zoom while Filters stays open. Check unsaved edits survive opening and
  closing the panel, and other view controls do not accidentally save them.
- [ ] Open the calendar: check it sits above the bottom status bar and fits beside
  Filters without overlap. On narrow screens, opening either panel should close
  the other; compact calendars should remain scrollable and usable.

Terminal checks cover modeless opening, live edits, Save/Cancel, search-independent
currency toggles, saved preference isolation, bottom positioning, collision
avoidance and resize cleanup. Visual placement and chart interaction remain for
manual verification.
