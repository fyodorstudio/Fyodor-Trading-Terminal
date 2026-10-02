# Research and Terminal Backlog

This is a parking place for visions, questions, and possible future work. **It is not a research protocol, a task order to execute all at once, or evidence that a trading setup has been registered.** Only **P0** is the active question; P1 onward is queued or parked, not homework to do in parallel. A checked box means the stated acceptance condition has actually been met; an attractive chart or a code change alone does not count.

The maintained research definitions and calculations belong in `C:\dev\Fyodor Math Lab\Expanded Macro Research`. The Trading Terminal consumes an audited snapshot for chart inspection and notes; it must not quietly invent or recalculate a different signal. Existing historical packages remain intact when a new hypothesis is tried.

## P0 — ACTIVE: same-time CPI co-releases

**One question:** What differs when **Initial Jobless Claims** or **Retail Sales** is released at the exact CPI timestamp, compared with CPI timestamps without either co-release? This is a descriptive comparison, **not** proof that one report caused the price move and not yet a new trade filter.

- [ ] Audit what **“outside rule”** means for the episodes under inspection: separate missing source readings, zero A−P, rule-specific abstention, price/ATR/entry coverage failures, and other reasons. Do not merge them into an unexplained “no trade.”
- [ ] Reconcile exact same-timestamp families from the pinned calendar and the study cutoff **before** looking at returns. The full export inventory contains **32 Claims coincidences and 12 Retail Sales coincidences among 139 CPI m/m-anchor timestamps**; those are inventory counts, not automatically the eligible analysis N. Keep the `2025-12-18` CPI release visible even though both m/m constituents are absent and Claims coincides.
- [ ] Compare Claims-coincident, Retail-coincident, and neither-coincident CPI episodes without changing the existing CPI direction, entry, ATR, stop/target, or H60/H120/H240 rules. Count **independent releases by year**; disclose pair observations and parameter trials separately. Show the signed-pip path, barrier outcome, adverse/favorable moves, and exceptions, not only pooled gross R.
- [ ] Preserve winners and losers. A co-release label alone does not establish its direction or relative importance. Before treating Claims or Retail as an **active** signal, separately define its constituent fields, units, A−P meaning, zero/missing behavior, timestamp, previous-value vintage, and any rule that combines it with CPI.
- [ ] Stop after a reproducible descriptive answer and a decision about whether either family deserves a separately specified follow-up. Do not silently reclassify these releases as “CPI-only,” register a setup, or mount new trade arrows from this comparison.

## P1 — QUEUED: separate YoY CPI interpretation

The existing CPI bundle has four source series—headline/core m/m and headline/core y/y—but its **six priced interpretations are four m/m candidate rules plus two m/m conflict-only comparisons**. YoY is currently descriptive context, **not** an independently simulated direction rule.

- [ ] Define a **YoY-only A−P comparison** without changing the existing m/m study. Decide explicitly what happens when headline and core YoY agree, disagree, are zero, or are missing; declare direction and abstention before examining its price outcomes.
- [ ] Compare YoY and m/m on the same episodes, H1 entry, ATR and initial exit settings wherever both are available. Show releases kept, dropped, or direction-changed and identify YoY-only episodes separately.
- [ ] Give `2025-12-18` its own audit row: both m/m constituents are absent, both YoY constituents are present, and Claims coincides. The Terminal's purple up arrow is **context only**, not a YoY backtest or a source of SL/TP statistics. Never silently substitute YoY into an m/m rule.
- [ ] Show unique release N, pair-observation N, repeated parameter-trial N, results and adverse moves by year. State that A−P is a change in a reading, **not** a measure of what surprised the market; an exported `Previous` may not prove its exact release-time vintage. Stop at an auditable comparison, not automatic registration.

## P2 — QUEUED: CPI m/m magnitude, not an assumed score

- [ ] Investigate whether **p50–p90 or other predeclared magnitude bands** of `|A−P|` distinguish small from unusually large monthly CPI changes. Rank headline m/m and core m/m **separately against only earlier releases of that same series**; retain each change's sign.
- [ ] Before testing price outcomes, specify the historical reference length, minimum warmup, percentile formula, ties, rounded zero-heavy readings, missing/revised values, and the treatment of episodes with insufficient earlier data. A 90-day viewer lookback is not automatically an adequate percentile sample for monthly CPI.
- [ ] Compare agreement, disagreement, and relative magnitude without declaring that a p90 core reading has a known market-impact weight relative to a p50 headline reading. Report N and stability by year; preserve all tested bands and negative results. Do not retrofit thresholds to one memorable winning or losing chart.

## P3 — PARKED: known prior context and later-event what-ifs

- [ ] Inventory candidate **USD** families in stages: Claims/Retail first; then the NFP labor bundle, PCE inflation, PPI inflation, and Fed decisions; later ISM/PMI, GDP, and other justified families. PPI measures producer-side prices rather than CPI's purchaser side ([BLS](https://www.bls.gov/ppi/overview.htm)); the Fed's inflation target uses PCE ([Federal Reserve](https://www.federalreserve.gov/economy-at-a-glance-inflation-pce.htm)). These are plausibility leads, **not proven correlations or automatic score components**.
- [ ] For each selected family, display its **last published value known by CPI entry even if it predates the H240-prior chart window**. Include source, release timestamp, actual/previous where reliable, and age; mark unavailable or stale information explicitly. Initially this is inspection context, **not** an input that changes the CPI direction or trade eligibility.
- [ ] Separate **known before entry**, **same-time CPI bundle and outside co-releases**, and **events after entry**. Never feed a later actual result into the initial CPI signal. An archived calendar does not by itself prove when a historical future schedule became known; label reconstructed schedules accordingly.
- [ ] For predefined major events within the observed H240 post-entry path, keep **two what-if views**: (1) annotate event timing next to the unchanged fixed-H240 outcome, and (2) compare a separately specified exit **before** the next selected major event. Freeze the event set and exact exit-bar boundary before calculation; do not treat a censored exit as a TP, SL, or ordinary expiry. Different later releases may have very different magnitudes.
- [ ] Compare immediate H1-based reaction with H60/H120/H240 outcomes. H1 candles cannot resolve the exact first minutes after a non-hourly release. H240 means **240 observed H1 candles**, roughly two FX trading weeks, not a fixed 14-calendar-day interval or a claim that CPI alone caused the whole move.
- [ ] Only after the context inventory and calculations are audited, consider a small, explicit **context-aware CPI candidate** and a new Terminal snapshot. A timeline can display many facts; an executable rule must use a small declared subset whose availability by entry is defensible.

## Retired S + M sketch — preserve the intent, not the formula

The former `S good/bad = +1/−1` and `M good/bad = +1/−1` sketch was deterministic arithmetic, but equal points did **not** establish equal market influence. New research deliberately excludes Forecast-based surprise `S = A−F`; keep older A−F packages as historical baselines, not as inputs to new scoring. Preserve the useful question: **do multiple A−P components agree, conflict, or differ materially in size?** Test that with named states and past-only magnitude comparisons, not an invented equal-weight score.

## P4 — PARKED: family expansion and second-currency context

- [ ] Revisit the existing **NFP/payroll** study as a same-time *bundle*: payrolls, unemployment, earnings/wages, revisions, and any other relevant constituents must have explicit roles. Do not treat one payroll headline as the entire report.
- [ ] Research **Jobless Claims** and **Retail Sales** as independent recurring families only after the CPI co-release question, if their own data and sample support it.
- [ ] Later study **ISM manufacturing/services PMI**, **GDP growth**, PPI/PCE, policy decisions and other justified families in their own right. Each needs its own series definitions, direction semantics, units, publication timing, missingness and revision checks; do not copy CPI's sign mapping blindly.
- [ ] For EURUSD, eventually add **euro-area inflation and ECB decisions** as the deferred EUR-side context, distinguishing EUR from USD information. Expand to other pairs only within the documented usable candle universe and only after pair-specific direction mapping and independent episode counts are correct.
- [ ] Consider a compact economic **matrix/timeline** again only when it answers a concrete audit question. Possible display modes: factor grouping (policy/inflation/economy/other), exact release-time grouping, cursor-following context, and a locked chart range. This is a viewer idea, not a requirement to rebuild the old matrix or to score every calendar event.
- [ ] Explore whether support/resistance boxes or manual chart notes add useful forward-test context. Keep discretionary annotations separate from the historical algorithm unless a prospective rule is explicitly defined and tested.

## What would make a candidate worth manual chart audit?

- [ ] Show the **exact rule**: input series, A−P calculation, missing/zero/conflict behavior, pair direction, entry time, ATR calculation, SL and TP distances, expiry, and same-bar touch convention.
- [ ] Show how many **independent releases** generated the trades. Trial rows created by many ATR cells and horizons are not new independent events.
- [ ] Show target-first, stop-first, expiry, gross/mean R, MFE, MAE, and time-to-exit; split by year and direction. Costs may be evaluated separately by the Director, but historical gross results must be labeled gross.
- [ ] For a **predefined combination of event states**, show the historical distribution of signed-pip change, MFE/MAE, and realized barrier outcome at H60/H120/H240. Include N and a spread such as median and upper/lower quantiles, not just a seductive “100 pips” or “500 pips” example. This describes comparable past episodes; it is **not** a point prediction or proof that CPI caused every pip over H240.
- [ ] Check year-by-year and leave-one-year-out stability, adjacent ATR cells, alternative H60/H120/H240 expiry, and whether one exceptional episode or one regime creates most of the apparent edge.
- [ ] Show how a context rule changes the baseline: releases kept, removed, and direction-changed, by year; include outcomes and adverse moves for all three groups.
- [ ] Treat a broad parameter search as exploration. Record all tried interpretations/cells and negative results; do not present the best observed cell as if it had been the sole prespecified hypothesis.
- [ ] Inspect individual episodes on charts, including exceptions and conflicting evidence. Then, if the rule remains plausible, explicitly register a fixed **demo forward-test** candidate. Future prospective results must be recorded separately from the already-seen historical sample. A candidate is not a promise of income.

## P5 — PARKED: Terminal and viewer usability

- [ ] Make the Criterion episode label precise: distinguish **outside selected rule**, **missing inputs**, **zero change**, **data/coverage failure**, **context-only direction**, and **priced historical trial**. Preserve the reason in the episode detail and in counts that can be inspected.
- [ ] After the event inventory and calculations are audited, consider a bottom dock with **known prior context | CPI anchor | upcoming events** as left/middle/right columns. The left may display an older last-known value with its age; the right may show a historically reconstructed schedule or a live schedule, clearly distinguished from a result that was not yet known. This dock is an inspection aid, not a hidden rule engine.
- [ ] Offer m/m and YoY research selectors only when each has a separately audited outcome package. The currently visible YoY context arrow must never inherit m/m trial statistics, ATR barriers, or a “TP first” badge.
- [ ] Polish the Arrow Result dock, especially the audit-note column and the relationship between episode facts, research result, and the Director's personal thesis. Keep notes persistent and easy to find without making them look like measured inputs.
- [ ] Keep arrows, entry/SL/TP lines, expiry window and prior candles synchronized with the selected **audited** study. A visual arrow with no priced trial should be visibly different and should have no invented SL/TP.
- [ ] Keep the standalone HTML viewer as the detailed research-audit surface; publish only reviewed snapshots or shortlists into Terminal Criterion. Avoid duplicating the entire calculator or a large exploratory matrix in the frontend.
- [ ] Make human-facing naming simpler: show **family + rule + data cutoff/snapshot date** first. Keep technical lineage such as CPI/NFP V2 and CPI bundle V3 in an expandable provenance section or audit links, not as vocabulary the Director must memorize.
- [ ] Make version ownership clear: a calculation package version identifies a research result; a viewer build identifies a presentation; a Terminal Criterion snapshot identifies the copied, reviewed evidence. Do not update three unrelated Markdown files by hand to change one label. Prefer one maintained source of truth per repo and generated or linked summaries.

## Maintenance — do only when it clears a real obstacle

- [ ] Inventory genuinely dead code, duplicate generated files, and superseded packages **before** removing anything. Preserve raw-data provenance, the audited baseline, and any artifacts needed to reproduce a published chart or table.
- [ ] Refactor long viewer/frontend modules by responsibility when a feature change demands it; preserve numeric outputs and chart behavior with regression tests. Aesthetic organization alone should not interrupt the single active research lane.
- [ ] Keep heavy trial ledgers and raw exports out of ordinary Git history when appropriate, but maintain hashes, schema, reports and enough instructions to reproduce a snapshot from the locally pinned data. Never rewrite or delete historical evidence casually.
- [ ] Audit the mapping between Macro Research package, generated HTML, Terminal snapshot, episode arrow, and stored audit note whenever a new family or rule is mounted. A tidy UI is not proof that these numbers still reconcile.

## Parking rule

When a new idea appears, put it here and return to **P0**. Promote **one** queued item only after the active question has been answered or explicitly paused and its inputs, expected output, acceptance checks, and effect on existing baselines are clear. No item above authorizes silent data substitution, broad parameter optimization presented as proof, an automatic claim of a profitable/registered setup, or changing existing research packages or Terminal behavior by editing this checklist.
