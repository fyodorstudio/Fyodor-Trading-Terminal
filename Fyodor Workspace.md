# Fyodor Workspace

This workspace has **two maintained projects with different jobs**:

| Project | Owns | Does not own |
| --- | --- | --- |
| [Fyodor Math Lab — Expanded Macro Research](../Fyodor%20Math%20Lab/Expanded%20Macro%20Research/README.MD) | Pinned raw exports, research rules, calculations, tests, trial ledgers, audits, reports, and the generated HTML **research-inspection** viewer. This is the source of truth for historical research results. | The live, user-facing trading terminal or a claim that an exploratory result is a registered setup. |
| [Fyodor Trading Terminal](README.MD) | The **actual user-interactable application**: live broker-data display, charts, Criterion episode inspection, drawing tools, Notebook, and personal audit notes. Its bridge supplies market/calendar data to the app. | Recalculating or silently changing Math Lab research results inside the frontend. |

In short: **Math Lab does the math; Trading Terminal lets the user interact with reviewed results and the market.** Math Lab's standalone HTML viewer is an audit tool for research, not a second live terminal.

## How research reaches the Terminal

1. MT5 data is exported and pinned in Math Lab. Its documented contracts and calculation code produce auditable, versioned evidence. The raw exports and large local ledgers may be Git-ignored; their provenance and required hashes still matter.
2. Math Lab's generated HTML viewer presents those results for inspection. A display change is not a new calculation, and a visually appealing result is not a registered setup.
3. **Only after review**, a specific, checked research snapshot may be copied into the Terminal's Criterion feature. The Terminal records the source study/run and verifies the published artifact's hash. Chart arrows, levels, and episode details must agree with that pinned source; the frontend must not invent missing prices, signals, or outcomes.
4. The user audits episodes in the Terminal and records notes. Personal annotations and later demo forward-test results stay distinct from the historical calculation package.

The Terminal's live MT5 bridge and Math Lab's historical export serve different purposes. Live calendar or price data must not quietly rewrite a pinned historical study, and a new Math Lab result does not automatically update the Terminal.

## Naming and maintenance rule

Use the **study name, immutable research run ID, data cutoff, status, and source hashes** to identify a calculated result. A copied HTML page or Terminal snapshot has its own artifact hash and should point back to that research identity. Existing labels such as “CPI/NFP V2,” “CPI bundle V3,” and Terminal report `v1.0.1`/snapshot `v1.1.0` describe different historical runs or publications; they are **not** a single ladder of scientific progress or proof of profitability. Human-facing UI should lead with the family, rule, cutoff, and exploratory/registered status; technical IDs can live in provenance details.

Math Lab owns the calculation and evidence; Terminal owns its presentation and interaction. Update each project's maintained README or integration note only for changes it actually owns. Do not manually duplicate a new result across both repositories before it is audited and deliberately published.

## Current work and boundaries

The [research checklist](checklists.md) keeps one active question and parks later ideas. It is a backlog, **not** a frozen protocol or permission to implement all of its items at once. The current active work is **CPI & Event Timeline**: unfiltered inspection of CPI releases (2015 through partial 2026), four CPI readings, A−P deltas and EURUSD direction, separate m/m and y/y sums, and surrounding releases from other event families. The previous descriptive CPI comparison for releases coinciding with Initial Jobless Claims or Retail Sales, along with YoY candidate rules and magnitude percentiles, are queued or parked there.

Historical CPI/NFP results and the CPI bundle remain exploratory. **No setup is automatically registered for forward testing**, and neither historical gross returns nor chart arrows promise live profitability. The active Terminal Criterion view displays the audited publication of `USD_CPI_EVENT_TIMELINE_V1` (`run_20261003_outcomes_v2`, manifest SHA: `7FD0FBB2A66358ABDE1F2F2FFDDDC185248A309A75DE8E74B0C66036312BBCC0`), presenting all 140 CPI episodes and surrounding event blocks for chart inspection without interpretations or Claims filters. Consult each repository's own README and research/integration contracts for exact data scope, commands, caveats, and publication procedure.
