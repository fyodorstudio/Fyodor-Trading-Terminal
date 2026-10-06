# Claims v2 / Fed decision context v2 implementation audit

Implemented October 6, 2026. Speeches and other policy text are outside this pass.
These checks verify declared interpretation rules and chronology, not FX return
prediction or the cause of a rally. No price outcome selected the weights.

## Claims source

The active scorer replaces V1 with initial trend 45%, continuing trend 40% and
latest initial week 15%. Initial trend compares reported four-week averages
four reference weeks apart; continuing trend compares adjacent four-week means.
The latest week remains a smaller, overlapping new-claims vote. Related initial
signals share an evidence group. A weekly-only move gets Weak evidence.

The original V1 formulas are archived in the scoring library; no obsolete V1
scorer screen was added. V2 derived magnitude settings have their own key. V1
custom settings remain exportable/importable as legacy data and do not grade
V2. Raw Actual-minus-Previous settings remain unchanged.

Non-voting level context compares current smoothed initial and latest continuing
readings with the middle half of available observations in their preceding 52
reference weeks. At least 40 usable weeks are required. This minimum is a declared
coverage rule, not a statistical confidence threshold. A seven-week gap around
the 2025 shutdown leaves 45 usable weeks in several recent comparisons; partial
history is shown, without filling missing weeks or borrowing older observations.
Strict consecutive-week requirements still govern the directional features.

Level comparisons do not establish labor-market health, job finding, Fed intent
or another directional vote. Missing level coverage does not invalidate usable
short-term trends. Continuing benefit claims can be affected by eligibility and
exhaustion. Stored source revisions remain a historical-vintage limitation.

## Context and Fed view

USD context version: `usd-context-memory-v6.1`. Source: Elev8-Demo2, revision
78432. Base budgets, cadence aging and expiry remain intact. Three-release Claims
confirmation now requires the initial and continuing trends both to support each
report's direction. Qualified agreement with NFP is explained without an extra
vote; the existing bounded transfer against an aging Weak/incomplete opposing
NFP remains separate from the labor–inflation rule.

Fed v2's primary output equals the shared engine at the decision's exact
publication time, including rate holds. Rate action is displayed separately;
holds, hikes, cuts, statements and speeches add no new macro vote or age reset.
No claim about observed guidance is generated from a calendar event name.

A separately scoped numeric-rate history fetch anchors the latest usable earlier
meeting. Its context uses that meeting's own cutoff with the same current
filters/settings. Ambiguous latest meetings do not silently fall back to older
ones. Missing context makes a directional comparison unavailable. The decision
view owns one shared contribution table rather than duplicating the generic
publication panel.

All eight families enabled, automatic magnitudes:

| Decision in Asia/Jakarta | Broker decision timestamp | EURUSD context | Evidence | USD total |
| --- | --- | --- | --- | ---: |
| June 18, 2026, 01:00 | June 17, 21:00 | Short | Weak | +0.076453420638 |
| July 30, 2026, 01:00 | July 29, 21:00 | Long | Moderate | -0.723070685804 |

Different numerical contexts produce different hold-time biases. This does not
establish that economic context caused either price move. H1 Raycaster lookup
uses candle end; compare exact timestamps or a candle with no later publication
when checking parity with the decision view. Saved filters/manual overrides can
produce different outputs from these defaults.

## Verification

The complete frontend test suite, lint, TypeScript/Vite build and whitespace
checks passed. No browser automation or visual UI audit was used.

Stored Claims audit: **606 publications**, with scorer/Scatter equality for
values, points, boundaries, sample counts, input pairs and missing-data reasons.
Removing same-time/future inventory preserved every assessment, including level
context. Both level comparisons were usable in 566 publications.

| Period | Publications | Long | Short | Uncomputed | Reduced data |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2015–2019 | 260 | 96 | 136 | 28 | 31 |
| 2020–2024 | 261 | 97 | 164 | 0 | 0 |
| 2025 onward | 85 | 37 | 44 | 4 | 7 |

Counts describe output availability, not directional accuracy. Initial calibration
and missing records account for unavailable components; no artificial Long/Short
is assigned to completely zero or unusable data.

Production Inspector and Scatter workers matched their pure results. Observed
round trips were 339 ms and 495 ms, with 18/24 main-event-loop pulses. This checks
worker execution and transfer, not chart frame rate or a live UI benchmark.

The June–July shared-context window also passed six representative publication
replays with future events removed. Regression tests cover divergence between
the underlying trends, an isolated weekly spike, improving but elevated levels,
partial/unavailable long-term coverage, revisions applied to the correct window,
no overlapping initial-trend baseline, legacy magnitude isolation, Claims/NFP
confirmation, Fed hold parity, all-off filters, prior/future/ambiguous meetings,
publication gates and no duplicated Fed contribution table.

Reproduction from the repository root, after a production build:

```powershell
node frontend/scripts/audit-claims-v2.mjs storage/data/usd-menu-v5-design-snapshot.json storage/data/claims-v2-design-audit
node frontend/scripts/usd-context/audit-window.mjs storage/data/usd-menu-v5-design-snapshot.json 2026-06-17 2026-07-30 storage/data/claims-v2-fed-context-window
```

Detailed local JSON/Markdown outputs are ignored under `storage/data/`.
Original publication vintages cannot be reconstructed from later revised rows.

## Remaining manual audit

Inspect Claims v2's trend/level explanations and Scatter magnitudes, the Fed
context headline versus Raycaster at the same cutoff, previous-meeting timing,
shared independent filter toggles, low dock heights and chart panning. Speech
rallies remain uncovered by design. Broader price disagreements and the deferred
EUR side still require separate review.
