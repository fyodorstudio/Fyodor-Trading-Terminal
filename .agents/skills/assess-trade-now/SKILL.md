---
name: assess-trade-now
description: Refresh current currency news and qualitative fundamental implications on demand, saving scoped results to Currency News. Default publication lookback is three hours. Use for all-eight or focused currency refreshes; historical investigations and release countdowns have separate skills.
---

# Assess Trade Now — Currency News

Research the requested currencies and publication lookback; default to all eight
and three hours when unspecified. A pair scope means research both currencies,
without automatically recommending the pair. Respect chat-only/no-save requests.

Read [research rules](../../../docs/RESEARCH-RULES.md). Read the focused current
result with `pnpm analyst news read --scope <currency|ALL>` to reuse source routes
and dated background. Retrieve `pnpm analyst news lessons --scope <currency>`
when a mechanism or repeated process failure is relevant; never load whole raw
archives or run a retired scoring/learning loop for a routine refresh.

Browse current sources. Open decisive original articles/releases, verify their
publication times and facts, consolidate syndications, and check material contrary
news. Use the actual check time to define each currency's publication window.
A new retrieval clock or a minor article edit cannot make old facts fresh.
Keep older still-relevant background separately dated. Do not force an item quota,
a directional conclusion or eight fresh-looking rows from narrower research.

Write concise facts, qualitative implication and a short causal reason addressing
material opposition. Supportive, negative, mixed and no clear fresh signal are
valid. Distinguish no qualifying story from inaccessible or incomplete coverage.
Do not claim exhaustive coverage. Do not turn a news refresh into pair rankings,
D1 forecasts, price scans, future-calendar sweeps, alarm changes or evaluation.
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

Present a compact table matching Currency News: Currency | latest verified
information (Jakarta AM/PM) | fundamental implication | direct sources. Name
material coverage limits. Do not delay a useful sourced answer for unrelated
bookkeeping. No background AI invocation follows.
