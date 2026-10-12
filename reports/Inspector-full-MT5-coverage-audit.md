# Full MT5 Inspector coverage and upcoming-only Alert — 12 October 2026

## Findings and fixes

The previous Inspector catalog intentionally admitted 283 event types. The user
changed the scope to include every event. The V4 export's **1,051** metadata records
now enter the catalog, including low-importance events, holidays and unnamed rows.
Original family IDs/settings remain stable; source-country/sector and publication
name stems organize additional controls. Search also matches source names/IDs.
Each currency has a selectable Other / new MT5 events fallback for future IDs.
Source observations remain unmodified; catalog expansion adds no scoring models.

The BoJ rate decision **392060022**, MT5 value **264440**, was already registered.
Its permanent tentative timing mode (3) incorrectly suppressed its publication
clock even after Actual arrived. Storage now recovers its supplied non-midnight
clock using recorded capture offset and verified broker profile. Derived timing
repair is idempotent and does not rewrite raw observations. Date-only schedules
remain explicitly dated; their icons use the first available candle on the source
day. Historical days without any candle cannot place an icon.

Alert previously retained incomplete numerical releases and unconfirmed commentary
for 30 days. Next 7/30/60/90 days now excludes elapsed releases, regardless of Actual
availability or timing mode. Current-day date-only schedules may remain because the
hour is unknown. Full calendars use eight-currency storage scope instead of a
series URL exceeding the 512-ID cap. Currency buttons filter locally.

## Authoritative data

V4 inventory: `storage/data/inventory/3bb4ab8e262a_20260928_021936_79538281/`.
The export covers January 2015 through September 2026; the current publisher fills
the remaining interval. Manifest IDs/country/currency match `calendar_events.csv`
exactly. Read-only live inventory audit on Elev8-Demo2 found **125,690** observations,
**1,037** distinct event types and **zero unmapped stored types**. Metadata-only
types without stored observations remain selectable; no readings are fabricated.

| Currency | Export types covered | Stored types admitted | Family controls |
| --- | ---: | ---: | ---: |
| USD | 248 | 247 | 177 |
| EUR | 278 | 278 | 182 |
| GBP | 115 | 115 | 69 |
| JPY | 124 | 124 | 74 |
| CHF | 40 | 40 | 23 |
| CAD | 74 | 74 | 40 |
| AUD | 89 | 89 | 59 |
| NZD | 83 | 70 | 54 |

Family totals include one new-event control per currency. Monthly/annual readings
and existing combined menu rows may share controls while retaining raw readings.
EUR coverage includes area, German, French, Italian and Spanish export records.

## Live checks

The restarted storage API returned all eight JPY observations on September 18,
including CPI, BoJ statement, rate decision, press conference and CFTC positions.
Production grouping/marker code placed all eight observations into five release
symbols against **5,000 actual USDJPY H1 candles** returned by the read-only bridge:
CPI's four readings share one release, while the other publications retain
their identities. The rate decision is timed at **1789710840** native broker seconds,
with **1789700040000** UTC milliseconds; original timing mode 3 remains on the row.

The actual all-eight-currency HTTP query returned 200, 239 rows in the sampled
current/next-nine-day collection window and 162 admitted upcoming episodes for the
seven-day selection. Every admitted exact release was inside the upcoming window;
no September 18 publication survived October admission. Counts are snapshot evidence,
not guaranteed future feed totals.

## Regression evidence

The complete independent export fixture verifies all 1,051 IDs, source names and
country/currency admission. Each of the 28 pairs verifies that every event for its
two currencies survives default filters and timed marker construction. New-ID
fallbacks, wrong-country rejection, unnamed rows, source-name search, date-only
placement, real BoJ identity/time/Actual, saved exclusions and Table-only WIP behavior
are covered. Real HTTP storage tests exercise all eight currencies and both series
limit boundaries. Old release exclusion is tested across modes 0–3 and 1/7/24/30 days.
The retained 19 magnitude families remain separate from expanded display coverage.

[MT5 timing definitions](https://www.mql5.com/en/docs/constants/structures/mqlcalendar)
confirm tentative schedules supply a date in advance and a time when the event occurs.
Visual layout and live chart review remain with the user.

Final gates: all 76 sequential frontend suites and all 39 storage tests passed;
frontend lint/build, repository navigation checks and diff whitespace checks passed.

## Independent filter recheck — 12 October 2026

Read the original exporter CSV files again and inspected the current database in a
read-only snapshot. All **1,051** metadata types have exactly one registered family
and one visible filter control, with no duplicate memberships or missing category.
The **123,256** exported releases, **125,751** current stored releases and **127,075**
raw observation versions contain **1,037** types each, with **zero unmapped types**.
All 28 pairs include every applicable event in their default preferences.

The recheck caught a search gap in combined controls: five ISM Services names and
eleven ISM/German/French PMI IDs were absent from the combined row's search text.
The controls and event admission existed; the combined row now searches every
member's source names and IDs. An exhaustive regression reproduced the failure
before the fix. All 1,051 source names/IDs now pass search coverage, and React DOM
tests verify every default control is rendered and checked for all 28 Inspector
pairs and all eight Alert currency tabs. This is terminal-based verification;
visual layout review remains with the user.

Recheck gates passed: major-pair catalog/menu suite, Inspector suite, Alert suite,
assembled terminal navigation suite, frontend lint/build and repository checks.
