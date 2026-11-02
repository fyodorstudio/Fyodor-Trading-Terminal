# Fyodor Trading Terminal Lite

## Task routing

Read this file, then only the relevant owner/contract in README.md. Implementation:
left-panel summary → `frontend/src/thesis/CurrencySummary.tsx`,
`storage/thesis_summary.py`, [Thesis contract](docs/THESIS.md#left-panel-summary-and-reassessment);
manual price alarms → `frontend/src/price-alerts/`; economic Invoke reminders →
[Alert contract](docs/EVENTS-ALARMS.md). These are separate data/notification paths.
Current research uses Assess Trade Now. Findings and currency assessments live in
the Thesis research ledger; the left summary is its read-only projection with
legacy daily reviews as fallback. Read `pnpm analyst thesis summary --scope ALL`.
Thesis shows one standalone currency at a time, selected with eight currency tabs
and Month/Day navigation. Earlier currency snapshots stay in a lazy archive;
saved pair journals and their planning days were deleted at the user’s request.
Release waits use One Minute Before Release; historical moves use Review Historical
Research and must not replace the live summary. Details and comparisons stay in
bottom Thesis; the left box shows evidence age, currency, standalone pressure
and checkpoint countdown. Assessment time never redates underlying evidence.
The left Fundamentals panel is the user's primary monitoring view. Authorized
live research must save its affected assessments and verify the summary API
against the frontend contract; a chat answer or ledger-save receipt alone does
not establish a usable panel update. Follow the skill's left-panel audit and
leave visual acceptance to the user. Each live invocation must complete the affected
research and refresh these rows; a save receipt or renamed status is insufficient.
Keep all eight Fundamentals rows visible without an internal vertical scroller or
repeated status headings. Anchor checkpoints to material currency-specific stages,
not every routine speaker. Future alarms remain high-impact-only, with one bell
per release package and explicit off choices preserved.
Thesis uses one two-column timeline: Time · Jakarta | Evidence and interpretation.
Combine developments, dated active background and earlier changed assessments;
show sources inline, a compact current judgment and one next invocation anchor.
Routine audit clocks/references/version bodies stay in storage and exports, not
reading disclosures. Presentation is owned by [Thesis](docs/THESIS.md#presentation);
the research skill owns concise authoring and mechanism-specific anchor selection.
Write normal, spaced prose; never compress research into joined words.
Separate currency codes, amounts and abbreviated units with spaces in research
prose: `JPY 330 bn`, `GBP 3.9 bn`, `128 bp`, `19:40 UTC`, `October 29`.
Keep source URLs, exact identifiers and original raw observations unchanged.

Market Watch, chart/drawings, raw calendar Inspector, upcoming Alert, Activity and
Settings, including agent-authored fundamental research journals and an archive
under Highlight. Research is produced in the market-analyst session; the terminal
may display saved research and provide occurrence-specific Copy Prompt actions.
Entry Trade is a manual trade journal with editable incomplete entries,
pinned arrows, sortable dates, archive/restore and one freeform journal box.
Its entries and edit history persist in the Git-tracked
`Market Analyst Workflow/entry-trade/journal.json`; preserve user technicals and
notes. The UTC event anchor (`eventAt`/`eventTitle`) controls table dating; the
chart-clock arrow time is independent and may be in future empty space. No
completeness gate, trade execution or automatic Git commit is implied. No scoring, full Notebook workflow, Scatter Plot, Fundamental
Settings, Roofs, Raycaster, Candy or Workspace backup UI belong here. Keep the copied bridge unchanged.

Read only task-relevant owners. README.md covers commands/ownership;
docs/DATA-CONTRACT.md covers calendar, clocks and recovery. Keep docs short.
Preserve currency-shared Inspector family selections, Save/Cancel and persistence, all eight currencies/28 pairs,
all series, date-only timing, unknown-ID admission, blank-chart dismissal, the
shared date viewport, future axis and saved drawing interactions.
Display defaults to Jakarta (UTC+07:00, AM/PM). Shared broker-clock rules live in
`config/broker-clock-profiles.json`; unknown broker history must not use today's
offset. Preserve publication UTC independently of chart-placement availability.
Use readable text in both themes; secondary labels must not fade into gray.
Alert impact is agent-authored, matched by exact broker/value IDs or external key,
and defaults to Unreviewed. Never substitute MT5 importance or another broker's rating.

Keep polling clocks local, unchanged data/callback identities stable and viewport
work batched by animation frame. Cancel listeners/timers and stale replies.
Run frontend suites sequentially. For dependency/extraction changes use pnpm test,
pnpm lint, pnpm build and pnpm check:repo. Performance changes need deterministic
work counts and an assembled-terminal regression. Preserve storage/data.
Leave visual audits to the user: no browser automation, computer-use or screenshot
inspection without an explicit request.

The user grants standing permission to start or restart this repo's local
development stack and services, including `pnpm run dev:all`, calendar storage
and the alarm worker, whenever needed to load or verify changes. Proceed without
asking again. Preserve stored data and alarm choices; this permission does not
authorize trades or broker account changes.

## Market research routing

Real capital may be at risk. The saved verdict and checkpoint guide the user's
decisions and invocation timing; treat their reasoning and freshness as critical.
A recent assessment clock does not establish that fresh evidence was weighted
correctly. Apply the skill's test of the strongest opposite case before renewal.
Assess Trade Now includes [analyst learning](docs/ANALYST-LEARNING.md): retrieve
reviewed lessons, freeze delivered calls, then measure and review matured outcomes
within the invocation. Historical results never rewrite live verdicts or train
model weights. Learning outcome captures are authorised; current technical scans
still require the user's price-aware request. No background AI invocation follows.

For live fundamentals and Thesis updates use
[Assess Trade Now](.agents/skills/assess-trade-now/SKILL.md). For imminent release
waits use [One Minute Before Release](.agents/skills/one-minute-before-release/SKILL.md);
for historical moves use [Review Historical Research](.agents/skills/review-historical-research/SKILL.md).
Before research or analyst dataset work, read the task-relevant sections of
[the research reference](docs/AGENT-RESEARCH.md), which preserves the research,
source, persistence and dataset rules. Engineering-only tasks need not load it.

## Focused verification

`pnpm --dir frontend test -- price_alert` runs matching suites sequentially;
multiple filename fragments are accepted. Omit filters for the full frontend run.
Use the ownership map in README.md to find code and contract before searching
broadly. Extraction/dependency changes still require the full checks above.
