# Inspector event grading terminology

This directory documents Inspector's explicit, versioned reading-grading rules and the agreed NFP/CPI signed magnitude directions. Rules describe the selected release's displayed readings. They do not recalculate research results or execute trades.

Organize definitions by **release currency → event category → family**. EUR is EURUSD's base currency; USD is its quote currency. Grading colors have their own meaning: green Higher, red Lower, gray Unchanged/Missing/Unrated.

| Currency | Category | Family | Rule status |
| --- | --- | --- | --- |
| USD | Labor / wages | [Jobs report / NFP](USD/Labor/NFP.md) | Grading: `nfp-change-vs-previous-v2`; three-primary signed magnitude direction: `nfp-eurusd-primary-signed-magnitude-v1` |
| USD | Inflation | [US CPI / core CPI](USD/Inflation/CPI.md) | Grading: `usd-cpi-change-vs-previous-v2`; four-reading signed magnitude score: `cpi-eurusd-signed-magnitude-v1` |
| USD | Monetary policy | [US FOMC](USD/MonetaryPolicy/FOMC.md) | Decision-anchored episodes: `fomc-decision-anchored-v1`; Fed rate A−P sign colors only |
| EUR | All categories | [Existing notes](EUR/definitions.md) | No grading implemented |
| USD | Other families | — | No grading implemented |

Each future family document should record its scope and stable event IDs, reading definitions, comparator, raw A−P direction and any separate USD score convention, zero/missing handling, counting behavior, examples, limitations, sources and rule version. A family is graded only after its own rules are agreed and implemented; NFP rules are never inferred from another event's name.

Runtime definitions are [nfp-grading.ts](../grading/nfp-grading.ts) and [cpi-grading.ts](../grading/cpi-grading.ts), using the shared [reading-grading.ts](../grading/reading-grading.ts) engine. Histogram visibility is a saved Inspector preference (Hide histogram / Show histogram); hiding the histogram bars retains a compact Magnitude cell for each reading and does not change magnitude configuration, dataset counts or scores. Undefined magnitude cells remain empty. Signed USD score colors remain separate from Higher/Lower reading colors.

Raw calendar values, reference periods, revised Previous and A−P remain visible and unchanged.
