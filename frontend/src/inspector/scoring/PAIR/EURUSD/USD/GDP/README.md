# USD GDP v1

`policy/` declares GDP/consumption/final-sales weights 50/30/20 and stable IDs.
`assessment/` validates quarters and distinguishes the first stored estimate from
same-quarter revisions. The two populations calibrate separately. `GDP Sales`
is final sales of domestic product (GDP excluding inventory changes), not the
BEA private-domestic-demand aggregate; it shares GDP's output evidence group.
See [provider definition](https://www.mql5.com/en/economic-calendar/united-states/gdp-sales-qq).

Shared runtime/UI: `scoring/shared/runtime/expanded-release*` and
`scoring/shared/ui/ExpandedReleaseScore.tsx`. The pure extractor also supplies
Scatter's calibration class. Settings key scope: `GDP-V1-SIGNALS`.
Publication context uses the shared engine, never a future price outcome.
Policies, data limits and audit results are in the root scoring library.
