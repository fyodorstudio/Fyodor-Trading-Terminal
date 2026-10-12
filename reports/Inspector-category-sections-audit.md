# Daily Inspector category sections — 12 October 2026

Daily tables now reuse the exact category labels and order from Inspector Filters.
Each currency/day has one section per enabled category, with every source series
directly beneath it. Individual release-name heading rows are removed. Time cells
span simultaneous series; EUR's Country column disambiguates national CPI and other
identically named series. Periods, revisions, forecasts and native readings remain.

Speeches, repeated appearances, testimony and hearings follow their existing
catalog category, preserving source names and clocks. Unknown-hour schedules stay
Date only. Known numerical variants at one verified family clock count as one
release; commentary, unknown identities and unknown hours retain separate release
identities. Series badges continue to count every row. Scoring and individual
publication identities remain unchanged.

## Full stored-history audit

A read-only SQLite snapshot at revision **182975** contains **125,751** stored
observations. All survive grouping into **23,175** day/currency selections and
their category sections, with no duplicate/missing value IDs. A before/after
SHA-256 digest confirms the input observations were not altered.

| Currency | Series rows retained |
| --- | ---: |
| USD | 42,339 |
| EUR | 35,912 |
| GBP | 11,999 |
| JPY | 13,632 |
| CHF | 3,266 |
| CAD | 6,657 |
| AUD | 6,744 |
| NZD | 5,202 |

Production table rendering verifies the user's examples in Asia/Jakarta:

| Currency / date | Category | Series rows |
| --- | --- | ---: |
| USD / October 10 | Growth / activity | 2 |
| USD / October 10 | Financial markets | 11 |
| EUR / October 16 | Inflation | 16 |
| EUR / October 16 | Trade / external balance | 4 |

The complete 1,051-type independent fixture checks category membership and row
retention across all 28 pairs, including every speech type. Mounted tests cover
monthly/annual variants, different speakers and times, repeated appearances,
filter changes, unknown new IDs, national CPI labels and aligned shared time
columns. The assembled-terminal suite covers chart selection, dismissal, correction
propagation and zero regrouping/scoring work on pan. Visual review remains with the user.

All 77 frontend suites passed, followed by the focused exact Financial markets
example after the final markup check. Frontend lint/build and repository checks
also passed.
