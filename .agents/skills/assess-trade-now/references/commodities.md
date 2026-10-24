# Commodity candidates and instrument identity

Read when the brief sweep finds material commodity evidence or a commodity is
requested. Start with BRENT, WTI and GOLD from config/research-instruments.json.
The universe is selective, not a mandatory deep scan of every commodity. Other
commodities can be discussed with verified identity/sources but are not supported
by the current persistence/receipt registry; disclose that rather than using an
invented currency or unsupported saved ID. Extend the registry/contracts before
claiming their saved support.

## Select the clearer mechanism

Compare a commodity candidate with researched FX alternatives over the same
horizon. Explain why its active evidence is more concrete; clearer causality
alone does not establish better entry value after prices adjust. Treat Brent
and WTI as one oil mechanism unless a verified spread-specific difference
justifies separate opportunities. Do not count the same shock as independent
confirmation across correlated assets.

For oil check actual production/export losses versus targets or threats, shipping
and freight, inventory buffers/strategic releases, spare capacity, refinery demand,
consumption and supply-restoration developments. Seek the strongest contrary
development (for example resumed shipments or weakening demand). For gold check
real yields and expected policy, USD, verified investment/official demand and
funding or haven pressure; a generic geopolitical headline alone does not prove
gold buying. Separate physical consumption, hedging and financial positioning.
Futures structure can corroborate tightness but does not identify private motives.

## Sources and discovery

Run `discovery start --scope BRENT` (or WTI/GOLD), actual broker, same cutoff,
distinct output directory. The receipt includes USD macro/operations coverage
because quotation/funding can matter; this is not a USD directional claim.
The broker upcoming index is USD context, not an oil/gold event inventory.
Complete the three additional source families with opened bodies:

- `commodity-news`: fresh dated reporting plus the original authority for a
  material geopolitical, sanctions, producer or shipping development.
- `supply-demand`: oil EIA/IEA/OPEC and relevant producer/export authorities;
  for gold verified official holdings, physical/investment demand and relevant
  releases. Attribute estimates and methodology; unavailable access stays a gap.
- `market-structure`: identified provider/exchange prices and contract/calendar
  information, nearby/deferred futures when material, verified flow/positioning
  releases with their observation/publication lag. No invented real-time flows.

Verify the past hour, next six hours/overnight, fresh 24-hour developments and
at least seven days of schedules, including inventories, producer meetings and
material USD stages. Oil targets are not actual production; an announced stock
release is not barrels already delivered. Keep stock levels, changes, forecasts,
revisions and release vintages distinct. Use the same record/fallback/validate
procedure as currency receipts. Link promoted receipts to the main invocation.

External records use `instruments: ["BRENT", "WTI"]` or `["GOLD"]`; currencies
may be empty when no independent currency relevance is established. Existing
currency records stay unchanged. Discovery events retain the same instruments
and may have empty currencies. Pin through guarded External CLI, run preflight,
request dated chart icons and read back instrument identity, stage and version.
Never invent MT5 commodity calendar observations or call a USD-only receipt
complete commodity coverage. Date-only events keep unknown hours.

## Instrument and price evidence

Resolve benchmark versus actual instrument: spot, spot CFD, dated futures or
futures CFD; exact broker/exchange symbol, provider, contract expiry/roll and
price units. An alias in the registry is a chart-routing hint, not evidence a
contract is available or equivalent to another series. Do not splice spot CFD
OHLC with front-month settlements or mistake a roll adjustment for a macro move.

For a justified bounded capture use, for example:
`pnpm analyst ohlc --pair BRENT --symbol <verified-exact-symbol> --timeframe H1 --from <UTC> --to <UTC>`.
The canonical ID remains separate from the exact symbol. Commodity reactions
use price/percentage changes, never forex pips. Apply shared historical broker
clocks, lock, coverage/completed-bar and request bounds; leave the bridge unchanged.

## Dated Thesis

A requested fill saves the eight currency rows plus only supported commodity
opportunities in `commodity_opportunities`, under docs/THESIS.md. Keep commodity
identities/evidence separate from currency verdicts. Do not add commodity news to
a USD row solely because the instrument is dollar-quoted. Shared relevant news
may be cited in both places with its distinct mechanism explained. No forced
commodity rows or opportunity quota. Each saved entry has explicit contract,
direction, active/conditional stage, same-day window, evidence and invalidation.
Future scheduled commodity stages may be saved as instrument checkpoints; never
store their expected results as occurred news. A daily window is not a promise
that the mechanism persists or an instruction to hold through every release.
