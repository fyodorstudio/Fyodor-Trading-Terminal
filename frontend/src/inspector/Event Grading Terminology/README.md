# Inspector event grading terminology

This directory documents Inspector's explicit, versioned reading-grading rules and the user-authorized experimental NFP majority direction. Rules describe the selected release's displayed readings. They do not recalculate research results or execute trades.

Organize definitions by **release currency → event category → family**. EUR is EURUSD's base currency; USD is its quote currency. Grading colors have their own meaning: green Good, red Bad, gray Unchanged/Missing/Unrated.

| Currency | Category | Family | Rule status |
| --- | --- | --- | --- |
| USD | Labor / wages | [Jobs report / NFP](USD/Labor/NFP.md) | Grading: `nfp-vs-previous-v1`; experimental EURUSD direction: `nfp-eurusd-majority-v1` |
| USD | Inflation | [US CPI / core CPI](USD/Inflation/CPI.md) | Grading: `usd-cpi-vs-previous-v1`; four-reading signed magnitude score: `cpi-eurusd-signed-magnitude-v1` |
| EUR | All categories | [Existing notes](EUR/definitions.md) | No grading implemented |
| USD | Other families | — | No grading implemented |

Each future family document should record its scope and stable event IDs, reading definitions, comparator, favorable direction per reading, zero/missing handling, counting behavior, examples, limitations, sources and rule version. A family is graded only after its own rules are agreed and implemented; NFP rules are never inferred from another event's name.

Runtime definitions are [nfp-grading.ts](../grading/nfp-grading.ts) and [cpi-grading.ts](../grading/cpi-grading.ts), using the shared [reading-grading.ts](../grading/reading-grading.ts) engine. Raw calendar values, reference periods, revised Previous and A−P remain visible and unchanged.
