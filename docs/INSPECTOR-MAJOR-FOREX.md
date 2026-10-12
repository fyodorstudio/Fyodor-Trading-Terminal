# Inspector: major currencies and pairs

Eight currencies support seven USD majors and 21 non-USD crosses. Pair identity
follows EUR, GBP, AUD, NZD, USD, CAD, CHF, JPY precedence. Broker suffixes share the
canonical pair's preferences. Unsupported instruments have no Inspector families.

| Currency | MT5 event types covered |
| --- | ---: |
| USD | 248 |
| EUR | 278 |
| GBP | 115 |
| JPY | 124 |
| CHF | 40 |
| CAD | 74 |
| AUD | 89 |
| NZD | 83 |

All **1,051** types in the 28 September 2026 MT5 export are available. Original
family IDs remain stable; additional controls group publication-name stems by
source sector and country. Search, category selection and configurable symbols
apply to every family. Housing, trade, government, markets and holidays have
separate categories. Unnamed events remain inspectable by source ID.

Each currency's Other / new MT5 events control admits future numeric IDs with
valid currency/country metadata, preserving source names. Known IDs with wrong
metadata remain rejected. Inspector queries every event for the pair's currencies.

Every pair reuses its two currency catalogs, with separate saved selections,
symbols and colors. EURUSD's existing scoring views remain available. The other
27 pairs offer Table only and disabled Scatter Plot (WIP), including their USD/EUR
readings. No new currency scorers, bands or formula changes are included.

FOMC minutes are a separate Monetary policy family. The startup date preset is
12 months before today through 90 days after today. The date picker starts with
Today as its anchor; Before reflects the full calendar year (365 or 366 days),
and After is 90. February 29 clamps to February 28 in the preceding year.

Known catalog admission uses exact MT5 IDs plus country/currency. The manifest
is `frontend/src/economic-calendar/catalog/source-events.json`; independent export
metadata in the Inspector fixture verifies every source ID across all 28 pairs.
Scoring admission remains separate.

**Group symbols: By release / By day** is saved independently for each pair.
By release retains individual publications. By day provides a separate calendar
icon per currency, with a badge counting series rows. Clicking opens one table
with the same category sections as Filters and all original Series/Actual/Previous/
A−P readings; Forecast appears when supplied. Revised priors, periods and revisions
remain visible. A ten-series CPI release retains ten rows under Inflation.
Series within each category follow publication time; a shared Time cell avoids
repeating a clock on simultaneous rows. EUR includes a Country column to distinguish
national series with identical names. Speeches retain every speaker and appearance
under their configured filter category. Daily sections use the selected display timezone; unknown-hour schedules keep
their source calendar date and are labeled Date only. Family/date filters apply
before daily aggregation, including separately timed policy/PMI publications.
Daily tables do not create aggregate scoring or magnitude histories.

All-day, no-time and tentative schedules have explicitly **Date only** symbols on
the source calendar day; no exact hour is invented. A tentative numerical release
with Actual and a supplied non-midnight publication time can use its recorded
capture offset and verified broker profile after publication. This includes the
BoJ rate decision (392060022). Raw timing mode and timestamps remain unchanged.
Historical dates without a containing chart candle cannot place a symbol.
[MT5 timing semantics](https://www.mql5.com/en/docs/constants/structures/mqlcalendar).

Saved pre-expansion selections gain newly added families once; existing disabled
families, symbols, colors and Show symbols remain intact. Empty selections stay
empty. Saving records the catalog version so subsequent removals remain removed.

Alert shares the full family catalog but keeps independent filters. Its Next
7/30/60/90 days selector admits only the upcoming window. Missing historical Actual
values and elapsed speeches do not keep old rows in Alert.

Publisher V2.0.4 accepts backfill for all eight currencies. Older publishers retain
their original currency capabilities and cannot lease unsupported jobs. Historical
inventory can be safely reimported to add the newly supported currencies. See
[setup](SETUP.md) and [storage contract](STORAGE-CONTRACT.md).
