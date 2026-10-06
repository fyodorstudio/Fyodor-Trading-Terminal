# Raycaster / shared USD context memory v6

Subsequent source correction: [NFP provider prior-field integrity audit](NFP-prior-field-integrity-audit.md).
The source-parity findings and totals below describe v6 before that correction.

Implemented and audited 6 October 2026. This addresses the user's June 17–18,
2026 and December 2025–January 2026 context findings. It changes the shared
context engine; CPI/NFP/Claims/ISM/Retail/PCE/PPI/GDP standalone math and signal
magnitude settings remain intact. CPI v4 and other publication panels receive
the same policy changes as Raycaster.

## What the June replay established

At the screenshot's June 17, 23:59 broker cutoff, v5's USD total was −0.0395,
hence EURUSD Long / Weak. NFP contributed +0.375 and newly published Retail
+0.042, but Claims −0.220, CPI −0.070, older PCE −0.100, GDP −0.060 and
PPI −0.014 narrowly outweighed them; ISM added +0.0075. This was a narrow
weighted interpretation rather than broad agreement.

The earlier December replay also exposed thin reports retaining their assigned
influence: the December CPI had only 20% of nominal scoring components usable;
NFP had 45%. The original source totals already omitted unavailable components,
but context applied no additional caution for coverage and no gradual aging.

The [official June 17 Fed statement](https://www.federalreserve.gov/monetarypolicy/files/monetary20260617a1.pdf)
described solid activity and elevated inflation while maintaining the rate range.
This is a confirmed content gap in the numeric calendar engine. V6 does not
import/classify this statement, add a rate-hold vote, or claim it caused the
observed price drop. Historical Fed guidance and EUR context remain deferred.

## Declared v6 rules

The source vote is its unchanged signed total multiplied by assigned weight,
age retention and nominal component coverage. Coverage is the usable nominal
component weight divided by all nominal component weight. Intentional NFP
participation adjustments use base weights to avoid being penalized again as
missing data. Usable zero readings count toward coverage.

This coverage multiplier is an additional cautious interpretation rule: source
totals already omit missing components. It is not a mathematical correction to
those totals, a statistical confidence estimate or a probability transformation.
Weak/Moderate/Strong evidence grades do not receive numerical multipliers.

Retention is `2^(-ageDays / halfLifeDays)`. Age advances at broker calendar day
boundaries. Half-life defaults follow cadence: Claims 7 days, monthly families
30, GDP 90. Existing 14/45/120-day hard expiries remain. Daily states are computed
in the background worker; hovering performs a binary lookup. An aging update is
explicitly labelled as memory change, not a new publication. No vote is restored
to compensate for missing, disabled, aged or expired influence.

Three complete, same-direction Claims reports 4–10 days apart, at least 80%
component coverage each, can qualify weekly confirmation. The latest must have
Moderate/Strong evidence and oppose an active NFP that is at least 14 days old
and Weak or incomplete. NFP shifts 30→20%, Claims 10→20%. Only the latest weekly
report votes, so overlapping observations do not accumulate independent points.
The rule is symmetric for USD strength/weakness and does not stack with the
existing labor–inflation transfer. Fresh or complete Moderate/Strong NFP blocks it.

Defaults and sensitivity variants were declared from cadence and coverage,
not selected by searching for matching FX returns. The user windows motivated
this change; they are development examples rather than independent validation.

## Results under all eight enabled inputs and automatic magnitudes

| Broker cutoff | v5 EURUSD | v6 EURUSD | v6 evidence | v6 USD total |
| --- | --- | --- | --- | ---: |
| 23 Dec 2025, 23:59 | Long | Long | Weak | −0.110729 |
| 31 Dec 2025, 23:59 | Long | Short | Weak | +0.047071 |
| 8 Jan 2026, 23:59 | Long | Short | Weak | +0.189467 |
| 9 Jan 2026, 23:59 | Short | Short | Weak | +0.175386 |
| 28 Jan 2026, 03:00 | Short | Short | Weak | +0.206775 |
| 17 Jun 2026, 23:59 | Long | Short | Weak | +0.024009 |
| 18 Jun 2026, 03:00 | Long | Short | Weak | +0.031357 |
| 12 Aug 2025, 23:59 | Long | Long | Weak | −0.227525 |
| 11 Sep 2025, 23:59 | Long | Long | Moderate | −0.372055 |
| 12 Aug 2026, 23:59 | Long | Long | Weak | −0.832901 |

The screenshot's June cutoff changes to Short but remains Weak: disagreement is
still substantial and the lead is small. The December 23 drop and later January
rally remain unresolved. Nothing forces a Long during every rally or a Short
during every fall. These are changes in declared fundamental interpretation,
not proof of price prediction or causal attribution.

## Broader verification and sensitivity

Same-source/revision v5 baseline: Elev8-Demo2, revision 78432. All 1,471
publication snapshots retained identical source IDs, publication times, standalone
totals, directions, evidence and coverage. V6 changed 66 combined directions:
55 of 1,265 before 2025, and 11 of 206 in 2025–2026. Weekly priority qualified
at 75 publications (70 before 2025); labor–inflation priority at 29. These are
coverage counts, not win rates.

Making all half-lives 25% shorter changes 15 of 1,471 directions versus default;
25% longer changes 11. Defaults were retained without FX optimization. Eight
publication cutoffs across 2017, 2020, 2022, 2025 and 2026 passed later-publication
removal; eligible following-day aging states were also checked. Stored revisions
can still contain later corrections; original vintage replay is not claimed.

The timeline contains 5,682 points. Compiled worker parity passed, with a roughly
20-second full-history calculation/transfer in this run while the main event
loop remained active. Serialized JSON diagnostic size was about 47 MB; this is
not a measurement of structured-clone heap size or chart-pan latency. Calculation
occurs on inventory/settings changes, not per hover. Further history compaction
is a possible performance refinement if the user observes startup or update costs.

The complete frontend test suite, lint and TypeScript/Vite build passed, including
cadence/coverage counterexamples, symmetric bounded Claims resolution, midnight
chronology, no forecast/future inputs, CPI v4 parity and mounted Raycaster tests.
Visual review remains with the user: gear factors, daily aging labels, saved
filters, short dock heights and chart panning.

## Reproduction and pending work

Preserve the ignored same-revision v5 baseline captured before the policy change:

```powershell
node frontend/scripts/usd-context/capture-baseline.mjs storage/data/usd-menu-v5-design-snapshot.json storage/data/usd-context-v5-baseline.json
```

That command captures the currently checked-out engine, not an archived v5
implementation. Do not overwrite the preserved v5 file after adopting v6.
To reproduce the comparison from the implementation before the payroll
prior-field correction, after building:

```powershell
node frontend/scripts/usd-context/audit-memory-v6.mjs storage/data/usd-menu-v5-design-snapshot.json storage/data/usd-context-v5-baseline.json storage/data/usd-context-v6-design-audit
```

The detailed local report is `storage/data/usd-context-v6-design-audit.*`.
The script intentionally asserts unchanged source formulas; it will reject the
subsequent NFP correction. Use the supplemental integrity audit's window replay
for the current implementation.
Live saved magnitude overrides or source exclusions can produce different values.
Next research remains timestamped Fed guidance, economic levels versus changes,
and the accepted EUR roadmap. The unresolved windows remain audit findings.
