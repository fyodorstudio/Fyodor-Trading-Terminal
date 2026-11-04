---
name: assess-trade-now
description: Refresh currency fundamentals and discover global volatility risks on demand, saving news, custom events and verified high-impact reminders. Use for all-eight or focused refreshes; historical investigations and imminent release waits have separate skills.
---

# Assess Trade Now — Currency News

Research the requested currencies; default to all eight and prioritize the newest
material developments plus relevant earlier context without a fixed cutoff.
Respect any explicit user research date range. A pair scope means research both currencies,
without automatically recommending the pair. Respect chat-only/no-save requests.
Map JPYX to JPY and USDX to USD fundamental research. Interpret mentions of rallies, resistance, breakouts or reversals as
requests for fundamental support, opposition and upcoming catalysts. Leave price
levels, chart scans, entries and other technical analysis to the user unless
explicitly requested; do not ask for technical levels to perform this skill.

Every invocation also checks global ongoing risks and the next seven days,
prioritizing the next 48 hours, even for one currency. Follow the
[global risk workflow](../../../docs/GLOBAL-RISK-WORKFLOW.md) for evidence,
cross-currency transmission, discovery receipts, global stars and alarm curation.
The short invocation alone authorizes saving verified material custom events,
showing new events globally and selecting new confirmed high-impact reminders.
Preserve explicit off choices, global pause, lead time and existing chart hides.
Chat-only/read-only/no-save suppresses these writes; do not imply continuous monitoring.

Read [research rules](../../../docs/RESEARCH-RULES.md). Read the focused current
result with `pnpm analyst news read --scope <currency|ALL>` to reuse source routes
and dated background. Retrieve `pnpm analyst news lessons --scope <currency>`
when a mechanism or repeated process failure is relevant; never load whole raw
archives or run a retired scoring/learning loop for a routine refresh.

Browse current sources. Open decisive original articles/releases, verify their
publication times and facts, consolidate syndications, and check material contrary
news. Record the actual source-check instant. File each story on its publication
date in Jakarta; when only the date is known, keep it explicit and let assessment
time supply sorting/age. When the entire publication date is unknown, use the
assessment date too. Never write an assumed hour into published_at. A later
assessment may move a date-only story up without making old facts fresh. A minor
article edit is not automatically a new development. Do not force an item quota,
a directional conclusion or eight fresh-looking rows from narrower research.

Use a stable story_id per development, shared across all researched currency
rows. Consolidate repeated coverage; a material follow-up gets its own ID and
dated row. Put source-faithful headlines or concise factual summaries in items,
without agent interpretation. Put commentary and coverage limitations in the
per-story, per-currency implication. Use bullish or bearish bias with a concise
causal reason. When mechanisms compete, use conditional and explicit bullish_if
and bearish_if scenarios rather than a bare Mixed label. Neutral is valid when
no supported direction or useful scenarios can be established. New saves omit
window_hours and background; published_date supports date-only publication.
Distinguish no qualifying story from inaccessible or incomplete coverage.
Do not claim exhaustive coverage. Do not turn a news refresh into pair rankings,
D1 forecasts, price scans or outcome evaluation. Global risk discovery and its
scoped event/reminder writes are separate from Currency News persistence.
If the user separately asks a deeper comparison, answer that scope using the same
source standards; keep news implications separate from any trading conclusion.

For an authorised save, read [the news schema](../../../docs/CURRENCY-NEWS.md),
write the small `NewsRefresh` payload under ignored `tmp/`, and run:

```powershell
pnpm analyst news save --scope <currency|ALL> --input tmp/news.json
pnpm analyst news read --scope <currency|ALL>
pnpm analyst news verify --scope <currency|ALL>
```

Only researched currencies change. A full refresh must investigate all eight or
explicitly report the unfinished scope. Never copy old rows with new clocks.
When a newer check already exists, reread and reconcile instead of changing the
clock merely to bypass rejection. Verify saved source clocks, implication, gaps
and API delivery. A save receipt alone does not prove panel delivery; if the
service is stale, restart this checkout's stack under standing permission and
retry. Leave visual acceptance to the user.

Lead with a compact risk table: event / Jakarta timing / cross-currency risk /
star and alarm status. Distinguish active unscheduled risk from a timed release,
and selected from armed. Disclose source, timing and delivery gaps. Then present
a compact table matching Currency News: Currencies / Sources | News
Fundamentals (Jakarta dates/times) | Implication. Keep analysis in Implication. Name
material coverage limits. Do not delay a useful sourced answer for unrelated
bookkeeping. No background AI invocation follows.
