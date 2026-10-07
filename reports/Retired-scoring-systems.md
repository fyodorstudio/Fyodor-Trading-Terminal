# Retired scoring systems — 7 October 2026

The interface now offers one current scorer per family. These notes preserve the
deleted methods and explain which calculation components remain in current use.
Retirement changes selection and presentation, not the active numerical rules.

| Family | Current public version | Calculation used |
| --- | --- | --- |
| CPI | v4 | Standalone v3.1 plus separate publication context |
| NFP | v2 | Five-component employment interpreter |
| Claims | v2 | Two underlying trends plus the latest weekly reading |
| ISM Manufacturing / Services | v3 | Shared same-month sector aggregation and one resolution |
| PCE / Retail / GDP / PPI | v1 | Their current declared standalone rules |
| Fed | v2 | Numerical action separated from publication-time economic context |
| EUR numerical families / ECB | v1 | Current distinct-period numerical interpretation |

## CPI original magnitude scorer / index companion — retired

Four rates (headline monthly, core monthly, headline annual, core annual) each
received equal weight. Actual minus supplied Previous determined the sign;
configured raw-series magnitudes provided 0 / 1 / 2 / 3 / 4 signed points. The
four points summed to a USD bias: positive meant EURUSD Short, negative Long.
All four scores were required; a missing, duplicate, unavailable or undefined
reading left the direction Uncomputed. Exact nonzero cancellation used core
monthly, headline monthly, core annual, then headline annual priority. All-zero
readings stayed Uncomputed. Forecasts were excluded.

The price-index companion separately displayed adjusted headline/core and
unadjusted headline/core signed magnitude points. Adjusted and unadjusted totals
were descriptive; they did not vote again in the four-rate direction. Native
unit/multiplier and country/currency checks guarded each score.

Retired because a large rebound from a low prior could dominate without explaining
the recent inflation pace. Raw reading tables, A−P magnitude configuration,
histograms and Scatter views remain active; their data/settings are not deleted.

## CPI v2 — retired

Four weighted signals: recent three-month core monthly average minus a 0.20%
monthly reference (35%); overlapping three-month core-trend change (35%); core
annual Actual−Previous (20%); latest headline monthly minus its preceding
three-month average (10%). The fixed monthly reference was a prototype choice,
not the Fed target. Each used its earlier history from January 2015, with at
least 24 usable signals. Nonzero absolute signals determined nearest-rank
33⅓ / 66⅔ / 90 percentile boundaries; tied limits could leave buckets empty.
Signed magnitude points 0–4 were multiplied by the declared weights.

All four components were required. Timing, native percentages, distinct source
identity, matching reference months and consecutive historical months were
checked. Direction used the weighted sum; exact cancellation followed the listed
signal order. All-zero signals stayed Uncomputed. No forecast or price vote.

Retired because a high but stable recent core level could create pressure toward
one direction without a fresh acceleration. Current v3.1 replaces that anchor
with latest core monthly minus the preceding three-month average.

## CPI v3 selectable view — retired; v3.1 engine remains active

V3 replaced v2's fixed-reference anchor with latest core pace while retaining
35 / 35 / 20 / 10 weights. It allowed reduced data without redistributing weights,
required a usable core component, and separated evidence agreement from historical
change magnitude. V3.1 refined evidence grouping: related monthly core signals
share one group; related annual/headline readings are not independent votes.

The separate v3 screen is deleted. Its v3.1 assessment, signal calibration,
source gates, worker and Scatter components remain the release calculation
inside current CPI v4 and Raycaster. V4 adds context before/after publication;
that combined result is never fed back as a CPI source vote. Both interfaces show
**CPI v4**, with **Standalone engine v3.1** disclosed beneath it.

## NFP original magnitude scorer — retired

Three equal primary votes: Nonfarm Payrolls A−P, inverse unemployment A−P,
and monthly earnings A−P. Each supplied signed raw-series magnitude points 0–4.
Their sum determined direction; exact cancellation followed payrolls,
unemployment, then monthly earnings. All three usable primary scores were
required. Missing supporting data did not gate the direction.

Annual earnings, participation, weekly hours, private/government/manufacturing
payrolls and U6 were displayed as supporting conventions, excluded from the sum.
Native payroll thousands, percentage rates and hours were checked. The formula
did not qualify falling unemployment by participation or compare hiring with
recent average pace. Current v2 adds those distinctions plus guarded revisions
and hours, with 40 / 30 / 15 / 10 / 5 base weights.

## ISM v2 selectable view — retired; sector calculations remain active

V2 grouped same-reference-month Manufacturing and Services, retaining original
publication clocks. Services carried 70%, Manufacturing 30%. Services component
weights were orders 35%, business activity 25%, employment 25%, prices 15%;
Manufacturing used orders 50%, employment 35%, prices 15%. Components compared
the latest index with max(50, preceding three-month average), substituting a
supplied revision for the nearest month. Below-50 rebounds remained contractions.
Each calibrated earlier history with the 24-observation gate and no forecasts.

Its screen displayed two separate publication-time biases: Manufacturing-time
context excluded later Services; Services-time context included earlier
same-month Manufacturing. Pending/excluded sectors stayed visible without
carrying an older month. Missing weights were not redistributed. Demand, labor
and price grouping constrained evidence; conflicts and ties limited evidence.

That separate two-output screen and its snapshot cards are removed. The shared
aggregation is retained as `ism-monthly-context`, since current v3 needs the
same original component votes. V3 resolves their weighted net once, explains
which sector dominates, and displays one final bias above both sector sections.
The stored sector magnitude keys remain intact even where their historical names
contain V1/V2; they configure current signals and are not obsolete scorers.

## Existing historical settings and reports

Claims v1 had already been replaced before this cleanup. Its inactive magnitude
key is retained only for old workspace import/export and never grades Claims v2.
Historic reports remain snapshots of the versions they audited; old executable
CPI v2 comparison tooling and legacy-only test suites are retired alongside those
formulas. Current assessment, chronology, calibration, worker and settings tests
remain. Saved `scoring-v2/v3/v4` choices migrate to the single current `scoring`
view on read and workspace import/export. Unknown values are not promoted.

Original implementation history remains in the scoring library and Git. This
archive documents formulas, not trading accuracy or a promise of price alignment.

## 7 October 2026 — Remaining unused magnitude presentation

The old `FamilyMagnitudeTally` screen was no longer mounted anywhere in the app.
It grouped Higher/Lower A−P readings into Small/Medium/Large/Extreme counts, with
unclassified/undefined and partial-history notes. It did not supply the current
standalone or context bias. Its renderer, family/NFP tally helpers and five obsolete
wrapper/re-export modules are removed in the responsiveness cleanup. Applicable
tests now use the active shared family history/cell modules; the retired screen's
own rendering assertions are removed.

Current per-reading magnitude cells, seven-band histograms, native-unit boundaries,
Scatter models, settings keys and all current scorer versions remain active.
See [Responsiveness refactor](Responsiveness-refactor.md) for the retained behavior
and terminal regression checks.
