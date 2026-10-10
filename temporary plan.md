# Evidence summary, Fed refinement and EUR expansion

Accepted 10 October 2026. Implement in this order; no migration of legacy Roofs,
Raycaster or Candy scores. Canonical USD policy: [scoring design](docs/scoring%20system%20overhaul.md).

1. **Publication summary.** Updated after user review: lead with the standalone
   direction and evidence strength, then show combined relationships beneath it.
   Align direction, strength and points in both summaries; retain overall
   `Evidence points: before → after` and `Change` using unrounded arithmetic.
   Keep each result's totals and concise explanation together, all text selectable,
   allow narrow-panel wrapping, and remove vertical-bar separators.
2. **Details selector.** Default to Release inputs; alternatives are Overall
   relationships, Freshness and Input audit. Render only the selected details,
   retain selection across releases, and keep the summary outside the selector.
3. **Before/after semantics.** Evaluate immediately before and at publication
   under the same selected families/settings. Include all simultaneous releases
   and identify the combined update. Audit corrections/expiry affecting the
   comparison. Preserve as-of vintages and unavailable-evidence bounds.
4. **Fed presentation.** Show Rate held/increased/reduced with the actual rate.
   Hold retains zero action points; overall direction comes from existing
   relationships. Do not duplicate macroeconomic inputs through a second Fed
   vote. Written-guidance interpretation is deferred; forecasts/speeches excluded.
5. **EUR inventory and standalone models.** Verify existing MT5 series, units,
   cadence, revisions and historical coverage for euro-area headline/core HICP,
   unemployment/employment, wage costs, GDP, manufacturing/services/composite PMI
   and ECB deposit-rate decisions. Reuse shared mechanics, review legacy formulas,
   document source rationale and explicit initial policy weights/boundaries.
6. **EUR relationships.** One period slot per family, flash/final replacement,
   national versus euro-area overlap safeguards, publication-time freshness and
   missing-evidence uncertainty. National releases are provisional context rather
   than duplicate full-area votes. ECB holds follow the same action/context rule.
7. **EURUSD comparison.** Evaluate both currencies at the same publication clock
   on a bounded ±100 evidence scale. Initial policy: `(EUR − USD) / 2`; propagate
   each side's uncertainty interval. Display both currency conclusions and the
   pair evidence balance, with no future information or missing-as-zero inference.
8. **Verification.** Sequential affected frontend tests, assembled-terminal tests,
   lint/build and read-only historical replay. Check simultaneous releases,
   corrections, expiry, partial input, before/after precision, Inspector/Scatter
   and worker parity. Record known vintage/calibration limitations. Visual UI and
   browser performance review stays with the user.

## Progress

- All eight accepted items are implemented and terminal-verified. The full 71
  frontend suites, 29 storage tests, lint and production build pass. Read-only
  replay verifies 3,595 EUR assessments, three same-clock pair snapshots and six
  production-worker jobs. [Evidence report](reports/Currency-evidence-R1-expansion-audit.md).

| Accepted item | Implementation and verification evidence |
| --- | --- |
| 1. Summary | `R1Score.tsx` and `r1-score.css`; mounted USD/EUR summary checks. Selectable text, flex alignment/wrapping, no bars or disclosures. |
| 2. Details | Persisted Details selector; mounted tests prove one table at a time, retained choice and zero jobs from changing tables. Workspace round-trip includes the choice. |
| 3. Before/after | `analysis.ts`; exact before clock, simultaneous slot updates, correction/expiry audit assertions, future-removal tests and March replay +0.22 precision. |
| 4. Fed | Action presentation and zero hold contribution; Fed cases, ECB hold/hike/cut/cap and mounted hold explanation. |
| 5. EUR standalone | `eur-profiles.ts`, shared features/assessment/history; native inventory and all-publication Inspector/Scatter replay. Distinct-period calibration, quarterly revisions and EUR-only settings tested. |
| 6. EUR relationships | `eur-relationships.ts` and freshness; composite/sector ownership, national non-duplication, partial coverage, quarterly momentum and expiry checks. Source roles and numerical policies documented separately. |
| 7. EURUSD | `pair.ts`/`pair.worker.ts`; same-clock normalized difference, unknown-side interval tests, mounted pair output and assembled ECB/settings navigation. |
| 8. Gates | 71 suites and 29 storage tests pass; lint clean, build passes with existing bundle warning. Latest production-worker replay passes; `git diff --check` and new-text encoding scan are clean. |

Manual review reserved for the user: summary alignment/select-and-copy at real
panel sizes, Details choices, PMI Assessment selection, EUR Scatter previews and
price comparison. No automated visual/browser-performance audit was performed.

Latest review supersedes the pair-summary presentation: show each currency
directly, and make Inspector visibility filters independent of scoring settings.
GDP quarterly calibration and repeated-load refinements are recorded in the
[scope/GDP/loading audit](reports/R1-scope-GDP-loading-audit.md). Saved manual
bands remain authoritative; no blanket conversion to fractional magnitude.
