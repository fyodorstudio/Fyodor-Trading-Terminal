# FX and cross-asset relevance audit — November 18, 2026

The user's research scope prioritizes USD, EUR, GBP, JPY, CHF, CAD, AUD and NZD,
while keeping commodities, metals and stock indices eligible when evidence is
stronger. Relevance is independent of direction, entry quality and Priority.

A recovered temporary copy of the local SQLite cache was audited read-only using
the saved Include/Exclude/automatic-filter profile. The source database was not
changed. The snapshot contained 8,938 distinct headline strings.
Targeted review examined market/macro exclusions and suspected included noise,
then every changed classification. This is a case audit, not a statistically
labelled precision/recall measurement or a claim of exhaustive coverage.

The final rules change 30 distinct headline decisions: 15 become Included and
15 become Excluded. Differences with article bodies cannot be resolved by
this headline-only classifier. Google discovery limitations remain separate.

## Changes reviewed

| Headline | Before | After |
| --- | --- | --- |
| Credit Selloff Lures Bargain Hunters to ‘Stock Picker’s Market’ | Excluded | Included |
| Putin says EU's Russian energy ban caused a 'humiliating' fall in EU living standards - Reuters | Excluded | Included |
| Credit Chiefs Warn of ‘Fear Factor’ as Debt Reprices All at Once - Bloomberg.com | Excluded | Included |
| EU reaches provisional deal to speed permits for renewable energy projects - Reuters | Excluded | Included |
| What to know about the energy permitting overhaul bill before US Congress - Reuters | Excluded | Included |
| Hungarian Forint: Dovish MNB pressures HUF against Euro – Societe Generale - FXStreet | Included | Excluded |
| Hungarian Forint: Dovish MNB pressures HUF against Euro – Societe Generale | Included | Excluded |
| South African Rand: Further weakness against US Dollar targets 17.50 - Societe Generale | Included | Excluded |
| US banking websites are having problems - investingLive | Excluded | Included |
| European miners drop as metal prices hit multi-month lows By Investing.com - Investing.com South Africa | Excluded | Included |
| UK plans to resist EU request to match tariffs on Chinese goods - Financial Times | Excluded | Included |
| Chase says ‘software bug’ could be causing disruptions at major U.S. banks - MarketWatch | Excluded | Included |
| Gold price in India: Rates on November 18 - FXStreet | Included | Excluded |
| Indian Rupee: Supported by flows and RBI steps – Societe Generale - FXStreet | Included | Excluded |
| "Three powerful tailwinds": Societe Generale explains the Indian Rupee's seven-month high - FXStreet | Included | Excluded |
| "Three powerful tailwinds": Societe Generale explains the Indian Rupee's seven-month high | Included | Excluded |
| Davidson Kempner Warns of Credit Markets 'Fear Factor' | Excluded | Included |
| Credit Chiefs Warn of ‘Fear Factor’ as Debt Reprices All at Once | Excluded | Included |
| Chainlink Price Forecast: LINK holds key support as ETF outflows, bearish bias persist | Included | Excluded |
| UAE stocks: DFMSI eases 0.20% while FADGI climbs 0.27%, as JPMorgan upgrades UAE equities to overweight | Included | Excluded |
| Indian Rupee: Supported by flows and RBI steps – Societe Generale | Included | Excluded |
| Credit Faces Tough 2027 as Default Fallout Widens: Markets Pulse | Excluded | Included |
| Metal Prices In Free Fall Flash Warning: Market Analysis | Excluded | Included |
| Gold price in India: Rates on November 17 - FXStreet | Included | Excluded |
| Hungarian Forint: MNB caution keeps range intact against Euro – Societe Generale - FXStreet | Included | Excluded |
| Hungarian Forint: MNB caution keeps range intact against Euro – Societe Generale | Included | Excluded |
| US banking websites are having problems | Excluded | Included |
| Gold price in India: Rates on November 16 - FXStreet | Included | Excluded |
| Deutsche Bank upgrades Croda stock on operational recovery outlook By Investing.com - Investing.com UK | Included | Excluded |
| US Senate to take up energy permitting bill votes next week, Whitehouse says - Reuters | Excluded | Included |

## Boundaries retained

- Credit selloffs, market-wide debt repricing and credit default spillovers qualify;
  an unrelated company's small credit facility does not qualify by itself.
- Broad metal-price declines and UK/EU/US energy or trade policy remain research
  material even without an index or FX ticker in the headline.
- An analyst's name is attribution when appended to a local FX report or explicitly
  giving a stock rating. It is not evidence that the named systemic bank is the
  subject. Actual bank funding, earnings, corporate/platform developments and
  global portfolio views retain their normal eligibility.
- Local daily gold/silver price listings stay excluded; import duties, demand,
  reserves and other meaningful metals spillovers retain the existing exceptions.
- Chainlink/Cardano-only technical prices follow the crypto filter. Explicit Fed,
  yields, systemic and target-asset context still follows the existing bridge rules.
- Custom Include/Exclude and automatic-filter switches keep their precedence.
  No keyword migration, provider changes, alert replay or paid API is introduced.

`tests/relevance_audit_fx_cross_asset.json` freezes the observed source/context
cases and additional counterexamples. `tests/test_relevance.py` verifies their
decisions and explicit Exclude precedence. Existing reader/export/arrival/phone
parity tests continue to exercise the same classifier.
