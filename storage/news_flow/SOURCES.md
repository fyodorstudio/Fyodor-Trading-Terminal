# News Flow source pack

The source of truth is `providers.py`: 52 active default provider entries. The v3 pack
added 20 entries to the previous 14; v4 adds 13 public market-news subscriptions. All use free public feeds or Google News RSS;
no account, paid API or article-body extraction is required.

`starter-providers-v5` adds missing entries once; the known broad Investing.com
feed is paused if its configured URL is unchanged. Cache/custom overrides remain. Existing provider names, URLs,
polling intervals, cooldowns and cached items stay intact. If a user already
added a feed under another name, its unique URL prevents a second subscription.
Browser keyword, visibility, colour and sound preferences are not migrated.
New entries are visible by default and can be hidden with the provider selector.

## V3 expansion entries

| Provider ID | Coverage | Live delivery |
| --- | --- | --- |
| `reuters-fx` | Currencies, dollar, euro, yen, sterling, franc, AUD/NZD/CAD | Reuters through Google News, 7 days |
| `reuters-oil` | Crude, Brent, WTI, OPEC and natural gas | Reuters through Google News, 7 days |
| `reuters-equities` | Stocks, indices, Nasdaq, S&P 500, Nvidia and earnings | Reuters through Google News, 7 days |
| `reuters-metals` | Gold, silver, copper, platinum, palladium and commodities | Reuters through Google News, 7 days |
| `kitco` | Precious and industrial metals | Kitco through Google News, 7 days |
| `rbnz` | NZD monetary policy, speeches and releases | Direct RBNZ RSS |
| `snb` | CHF monetary policy and speeches | Official SNB site through Google News, 90 days |
| `bea` | US GDP, personal income/spending, PCE and trade | Direct BEA RSS |
| `bls` | US employment, inflation and other economic releases | Official BLS release pages through Google News, 30 days |
| `eurostat` | European economic news releases | Direct Eurostat Atom |
| `ons` | Published UK statistical releases, 50 entries | Direct ONS RSS |
| `statcan` | Canadian economic and statistical releases | Direct Statistics Canada Atom |
| `abs` | Australian statistical media releases | Official ABS release pages through Google News, 30 days |
| `stats-nz` | New Zealand statistical news and releases | Official Stats NZ pages through Google News, 30 days |
| `swiss-statistics` | Swiss inflation, growth, employment, retail and trade | Official Swiss statistics sites through Google News, 90 days |
| `japan-economy` | Japanese inflation, wages, GDP, spending and unemployment | Reuters through Google News, 30 days |
| `japan-mof` | Japanese FX intervention and finance-ministry statements | Official MOF pages through Google News, 90 days |
| `eia-releases` | Energy forecasts and press releases | Direct EIA RSS |
| `eia-analysis` | Oil, natural gas and broader energy context | Direct EIA Today in Energy RSS |
| `eia-petroleum` | Weekly Petroleum Status Report and This Week in Petroleum | Official EIA pages through Google News, 30 days |

The existing pack retains broad Reuters, Reuters expectations, FXStreet, Fed
policy/speeches, ECB, BoE news/speeches, BoC releases/speeches, RBA releases/speeches,
BoJ and Treasury. Combined with RBNZ and SNB, the pack covers the central banks
of USD, EUR, GBP, JPY, CHF, CAD, AUD and NZD. Japanese economic news supplements
BoJ and MOF rather than claiming a working direct Japanese statistics feed.

## Retrieval and limitations

- Direct feeds have explicit Google historical scopes. Google-delivered feeds
  retain their publisher/topic constraints when date searches replace the live
  `when:` window. All searches remain best effort, not exhaustive archives.
- Google-delivered additions identify Google News in their display names. Its
  item timestamps are feed-supplied values, not independently verified release
  times. Results can include refreshed report pages and commentary.
- Dedicated topics increase retrieval coverage beyond a single broad feed's
  result window. Google commonly returns 100 entries; multiple feeds still do
  not guarantee every breaking story or delivery before a price move.
- The combined stream deduplicates exact article URLs. Similar stories with
  different URLs remain separate. Per-provider browsing preserves each source.
- Static report URLs can be updated in place. EIA's report search does not
  produce a guaranteed new arrival for each weekly inventory publication.
- First provider loads are silent. New matching live arrivals use the existing
  Include/Exclude and sound rules, including freshness and URL deduplication.
- Default polling remains one second, with existing per-provider overrides,
  bounded concurrency and Retry-After/backoff behaviour.

Live checks on 15 November 2026 returned headlines for every new configured
entry. The parser now handles EIA's relative article links and Statistics
Canada's XHTML titles/summaries. Counts change as publishers refresh feeds.

Direct BLS RSS returned HTTP 403 and SNB RSS failed local certificate validation,
so those additions use scoped Google delivery. TLS verification is unchanged.
Kitco's direct endpoints returned unsuitable/malformed XML; Google delivery is
used instead. OPEC's direct press index returned HTTP 403, and its Google search
mostly returned generic homepages, so no standalone OPEC subscription is seeded.
Reuters Oil includes OPEC coverage. A direct Japan Statistics search was also
too sparse/generic to seed; the targeted Reuters Japan economy feed is used.

## Official discovery pages

- [RBNZ feed](https://www.rbnz.govt.nz/feeds/news)
- [SNB feed directory](https://www.snb.ch/en/services-events/digital-services/rss-calendar-feeds)
- [BEA feed](https://apps.bea.gov/rss/rss.xml)
- [BLS feed directory](https://www.bls.gov/feed/)
- [Eurostat feed directory](https://ec.europa.eu/eurostat/web/rss)
- [ONS published releases](https://www.ons.gov.uk/releasecalendar?release-type=type-published)
- [Statistics Canada feed directory](https://www.statcan.gc.ca/en/sc/rss)
- [EIA feed directory](https://www.eia.gov/tools/rssfeeds/)
- [Japan MOF intervention releases](https://www.mof.go.jp/english/policy/international_policy/reference/feio/index.html)

Keep provider changes and parser fixtures in this feature folder. A new pack
requires a new migration marker, migration-preservation tests, a live bounded
fetch check, and a historical-scope check before enabling it by default.


## V4 public market-news expansion (16 November 2026)

All 13 endpoints below returned parsed headlines during bounded live checks.
They are added once without changing existing names, URLs, polls, cooldowns,
keywords, visibility or ntfy credentials/modes. New feeds prime silently and are
visible by default. Existing exact-URL deduplication remains; direct and Google
versions with different URLs may overlap.

| ID | Delivery | Parsed items in live check |
| --- | --- | --- |
| bloomberg-markets | feeds.bloomberg.com/markets/news.rss | 20 |
| bloomberg-economics | feeds.bloomberg.com/economics/news.rss | 14 |
| bloomberg-google | Google site:bloomberg.com | 100 |
| bloomberg-fx | Google Bloomberg currencies/forex scope | 100 |
| wsj-markets | feeds.content.dowjones.io/public/rss/RSSMarketsMain | 60 |
| wsj-google | Google site:wsj.com | 100 |
| marketwatch | feeds.content.dowjones.io/public/rss/mw_topstories | 10 |
| barrons | Google site:barrons.com | 100 |
| ft | www.ft.com/?format=rss | 12 |
| ft-google | Google site:ft.com | 100 |
| cnbc | www.cnbc.com/id/100003114/device/rss/rss.html | 30 |
| investinglive | investinglive.com/feed/news | 25 |
| investing-news | Google Investing.com/news market scope | 100 |

Bloomberg, Dow Jones publications (WSJ/MarketWatch/Barron's), and Financial Times
are grouped in the provider selector on desktop and phone. Original publisher
labels remain on headlines. ForexLive is now investingLive.

Google indexes Bloomberg and Dow Jones publications. A broad dowjones.com search
returned mostly corporate/product/login pages, so it is not seeded. A query for
Dow Jones Newswires mentions on third-party sites returned results, but attribution
and completeness were not dependable enough to label it a dedicated newswire feed.
Public headlines are free to fetch; linked articles may require subscriptions.
There is no paywall bypass, paid API, complete Bloomberg Terminal/Dow Jones wire,
latency guarantee or promise that every critical item is covered. Direct feeds
reduce reliance on Google discovery; Google searches supplement their short windows.

## V5 trading-focused expansion (16 November 2026)

Six endpoints returned parsed items in bounded live checks. New subscriptions
prime silently; existing provider URLs, polling settings and cache are preserved.
The original broad Investing.com query is paused once if its URL is unchanged,
because its low-value company/crypto volume duplicates stronger coverage. Cached
items remain searchable and collection can be re-enabled in provider settings.
There are 52 active starter subscriptions (53 rows on a migrated installation).

| ID | Delivery | Parsed items in live check |
| --- | --- | --- |
| iea-oil | Google official IEA Oil Market Reports | 3 |
| world-gold-council | Google official ETF/demand/commentary reports | 40 |
| silver-institute | silverinstitute.org/feed/ | 10 |
| china-nbs | Google official English NBS releases | 15 |
| seekingalpha-macro | Google targeted cross-asset/FX market news | 100 |
| intellinews-macro | Google targeted Japan, energy, bonds and sanctions | 100 |

Google supplements blocked or unavailable direct feeds; it is not a full archive
or a real-time wire. Public headlines are free; linked articles may be paywalled.
The tested PBoC English query returned no usable items and is not seeded.
BeInCrypto is not added: occasional macro coverage overlaps existing sources,
while most of its output falls outside the target trading universe.

Classification and its limits are documented in [RELEVANCE.md](RELEVANCE.md).
