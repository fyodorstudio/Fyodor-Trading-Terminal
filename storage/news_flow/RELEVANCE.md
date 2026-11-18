# Trading relevance

News Flow targets USD, EUR, GBP, JPY, CHF, CAD, AUD and NZD; Brent, gold/silver,
and broad stock indices. Other commodities, China, bonds, index companies and
geopolitics matter as transmission channels. Relevance is not a volatility,
direction, probability or trade-entry prediction. No article bodies or AI calls.

## One decision, all delivery paths

`relevance.py` decides relevance; `importance.py` decides the reading tier. `relevance.json` owns the editable seed (497
terms), aliases, context patterns, trusted institutional domains and observed
speaker aliases. `rules.py` keeps literal matching and normalization. Frontend
imports the same JSON for editable tags and literal aliases; it never implements
a second contextual classifier.

- SQL classification runs before count/paging for Priority, Included and Excluded, including
  copied results. All still returns all matching provider/date/search rows.
- Responses carry `relevance: {included, reason, keyword, tier, priority_reason}`. Desktop/mobile use that
  result for colour/reason labels, including official releases with no literal hit.
- Desktop sounds request the current scope from storage. Rule changes abort stale
  requests and keep the cursor. Blocked playback holds its cursor for at most one
  minute, including across rule edits; a later scope cannot replay an expired tone.
- The backend phone notifier uses the same store selection, independently of an
  open browser. Off / Included / All and the publication-age limit are shared
  by desktop and phone; only the desktop tone is browser-local.
- `market_relevance=false` retains literal Include/Exclude semantics. The UI
  checkbox is **Trading relevance**, in Global settings. All and Excluded retain
  access to rejected material for inspection.

## Decision order

1. Explicit Exclude wins. Avoid country, scandal or affair blacklists: they can
   hide genuine oil/metals/index/company transmission. No broad Exclude is seeded.
2. Verified official central-bank policy/speech sources remain eligible. Dedicated
   speech/monetary paths protect vague titles; general bank feeds require policy
   wording. Administrative banknote/museum/jobs notices are not protected.
3. Verified official statistical sources protect economic releases. Generic titles
   such as National Economy, Personal Income and Outlays remain eligible; unrelated
   demographic/admin notices do not gain blanket protection.
4. Target-country quoted remarks in financial news, plus a small observed speaker
   alias list with policy wording, protect abbreviated commentary. This is not an
   assertion of current employment or office. Unknown aliases are not invented.
5. Configured strong target terms can qualify directly. Broad country/person,
   AI, earnings, guidance, stock, financing and surprise tags require target context.
6. Topic guards reject crypto-only prices, local retail metal quotes, non-market
   topics and unrelated domestic-market stories. Global monetary/asset transmission,
   known index companies, energy/metals, geopolitics and explicit systemic crises
   retain exceptions. India gold import duties, sanctions-driven oil disruption,
   stablecoin reserve stress and NVDA governance allegations remain eligible.

Google's appended publisher/edition suffix is removed for contextual matching so
an Investing.com South Africa label cannot turn Swiss GDP into South African news.
The original headline/link remains unchanged. Raw literal mode keeps literal text.
Plural stock/bond/yield forms, compact currency pairs, index symbols, apostrophes
and common Unicode hyphens normalize consistently. Custom terms remain editable.

Official protection verifies actual article/feed hosts or exclusively trusted Google
site scopes, never a provider's editable display name or ID alone. Mixed Google
scopes cannot gain institutional trust. Explicit Exclude still overrides protection.

## Upgrade and control

Profile revision 3 upgrades previous seed vocabulary and preserves custom additions,
excludes, visibility, dates, colours, width and sound selection. Empty Include stays
empty (protected official sources can still qualify). If a custom list already fills
the 500-term limit, it is preserved rather than silently truncated; Add market keyword
preset reports capacity errors. Removing tags after migration does not reseed them.

Enabled old All sound modes switch once to Included for the requested relevant-only
alerts; Off stays Off. All can be selected again explicitly after the upgrade.
The original browser settings are saved once under
`fyodor.news-flow.v1.before-relevance-v2`; server phone rules are saved once beside
notifications.json as `notifications.before-relevance-v2.json`. Credentials are not
changed. Later rule edits preserve the selected mode and opt-out checkbox.

## Limits and evidence

The classifier uses headline text and verified source context. Context that exists
only inside an article remains unavailable. It can over-include or miss ambiguous
headlines and does not certify which assets will move. Review All/Excluded when
researching; there is no promise of exhaustive market-moving information.

Results and compiled rule patterns are bounded caches; rule profiles share their
long strings rather than copying them for each story. All historical metadata,
publication/collection time distinctions and manual Wildcards remain intact.

`tests/test_relevance.py` contains more than 100 explicit positive/negative cases,
including the observed Swiss GDP/equity/speech misses, cross-asset exceptions and
noise cases. It verifies reader/export/arrivals/phone agreement, trusted-source
boundaries and migration. The frontend relevance suite verifies migration, server
labels, aliases, sync, stale-response rejection and cursor continuity.

## Attention levels and chronology

Priority is a subset of the Included reading/export scope. Included shows both
Priority and regular relevant headlines, so one copy captures both without URL
duplicates. Priority remains available on its own; Excluded is separate. The
boolean included and Included alarms also cover both relevant levels. Explicit Exclude overrides stars. Other manual stars can promote
research outside automatic relevance. Automatic Priority requires relevance and
explicit headline evidence of a rate decision, policy change, intervention, data
surprise, supply disruption, systemic stress, a major geopolitical development,
or quantified policy expectations. Preview/question/speculation guards keep
ordinary commentary at Included. A vague official speech is protected for relevance,
not automatically high importance. No article-body inference is introduced.

Routine low-level trading appointments, promotional/how-to stories and generic
fund retrospectives have narrow noise guards. Index-company CEO and AI leadership
changes remain eligible. Avoid blanket country/personnel/company exclusions.

sort_by=collected uses immutable first_seen; published uses stable timeline_at.
Both support newest/oldest and stable ID ties. Date predicates and export windows
remain publication-based, with the existing missing/future fallback. URL dedup
chooses the earliest collection in the selected provider scope before ordering.
Legacy priority/organizer/currency research query parameters remain for older
clients; current UI uses mode=priority and this shared tier contract.

`tests/test_attention.py` verifies tier boundaries, previews, manual stars,
reader/export/phone agreement, stable collection sorts, duplicate fetches,
publication date scopes, API validation and bounded ntfy formatting.

Observed recall fixes include the publisher spelling Nvida, Google/Alphabet,
US labor-market wording, hyphenated stock-market titles, two-way AI funding/risk
and semiconductor trade-control context, and named sector bellwethers. Official
ECB speech article paths and central-bank statistical releases receive verified
protection. Country-only, generic AI entertainment and small-company guidance
remain excluded; explicit Exclude still wins. No preset reseed is required.

## Delivery age is separate from relevance

arrivals(max_age_seconds=...) filters raw trusted publication time, not first_seen.
The shared trigger selects both relevant tiers for Included and any tier for All;
either mode still enforces the age limit. /notifications/settings changes only
mode and age. /notifications/rules changes only keywords/providers. The desktop
uses /arrivals?configured=true and ntfy uses the same saved profile. Default age
is 86400 seconds; whole hours up to 365 days or null for unrestricted. Unknown
publication cannot be certified recent. Historical browsing is never age-filtered.

## Archive audit refinements (November 17, 2026)

The 471 editable tags remain unchanged. Expanded shared aliases cover consumer/
producer prices, PSI and regional manufacturing indices, Swiss economy wording,
Treasurys, data-center/data-centre, supertankers and European gas. Specific
context rules retain chip shipment limits, AI/data-center financing and risk,
equity fund flows, intervention warnings and target-market housing reports.
Unrelated domestic-market stories do not gain a blanket AI/spending exemption;
explicit AI/semiconductor risk and rotation can qualify as cross-market context.

Swiss statistical hosts now receive the same verified macro-release protection
as other official sources. Official household spending, dwelling approvals,
services/production indices and international positions/payments are recognized.
Verified MOF/Treasury intervention, portfolio-holdings and relevant sanctions
headlines have a separate narrow rule; Treasury readouts and administrative
announcements do not automatically become economic releases.

Contextual matching removes an exchange label from a trailing ticker annotation
while preserving its actual symbol, so QQQ/NVDA still count and NASDAQ alone
cannot promote an unrelated company. Quoted currency amounts, analyst attribution,
CPI Card Group and clinical pipelines no longer act as target-market subjects.
Quote/category pages, routine Form 4/8.3 filings and corporate conference
invitations are rejected. Policy-speaker invitations stay eligible. Narrow
consumer/entertainment guards preserve material company events, governance,
earnings and reported stock moves. Originals, links and explicit Exclude checks
use the complete unchanged headline; literal mode remains available.

Priority distinguishes a reported decision from "to raise", calls for a hike,
Reuters polls and retrospective minutes. These remain relevant when qualified,
without being labelled a newly completed rate decision. Quantified policy
expectations and manual stars retain their existing behaviour.

`tests/relevance_audit_cases.json` holds 50 source/context examples from the frozen
archive audit. Tests cover these decisions, subject-versus-attribution boundaries,
source verification and matching reader/export/arrivals/ntfy selection. Regression
coverage is evidence for these cases, not an exhaustive accuracy guarantee.
Rules reclassify existing history on read; they do not generate new arrivals or
replay consumed alerts. User keywords, provider selections, age limits and phone
credentials require no migration or reset.

## Editable automatic filters (November 17, 2026)

`filter_policy.py` validates all 11 automatic filter/protection switches and the
editable other-market and cross-market exception keyword lists. Defaults live in
`relevance.json.filter_defaults`, shared with the frontend. There is no separate
hardcoded other-market country list. Both policy keyword lists match literal
whole words/phrases; unlike Include/Exclude, they do not expand hidden aliases.
Explicit Exclude remains authoritative, including over manual stars.

A country mention cannot defeat a configured cross-market exception such as a
Treasury sell-off. Clear moves in the eight traded currencies and target-country
macro releases also qualify when cross-market protection is enabled. Simply
mentioning USD as an unrelated currency's counterpart is insufficient. Treasury
meeting readouts stay eligible; explicit local crime/cartel sanctions without a
funding, energy or major geopolitical driver remain under the visible routine
notice filter. Each filtered/kept headline has a reason identifying the rule or
exception. These are heuristic relevance decisions, not a complete news guarantee.

The canonical `filter_policy` string contains only nondefault overrides, keeping
normal reading URLs small. `/items`, `/export`, `/arrivals`, configured desktop
alerts, ntfy and the read-only phone profile use the same policy. Missing fields
retain defaults; old notification-rule clients that omit the field preserve an
existing custom policy. Existing Include/Exclude tags, source selections, alert
mode, publication-age limit, credentials and stored news require no reset.

Settings expose the switches, editable lists and searchable keyword-group views.
The text-only `/classify` preview returns the decision and all Include/Exclude
matches without fetching articles or creating arrivals/alerts. Source-protection
checks need an actual article/feed context; the text-only UI explicitly states
that limit. Preview and rule changes never replay consumed arrivals. Tests in
`tests/test_filter_policy.py` cover the reported rupiah/Treasury case, narrow
local-news guards, every switch, editable lists, schema validation and consistent
reader/export/desktop/phone behaviour.


## Archive audit refinements (November 18, 2026)

A frozen read-only snapshot contained 10,917 provider entries and 7,809 distinct
headline strings. Full classification was followed by targeted review of market-
related exclusions, likely noise and every changed decision. This is regression
evidence, not a statistically labelled accuracy or completeness guarantee.
`tests/relevance_audit_20261118.json` adds 128 reviewed source/context cases;
additional tests cover near-miss counterexamples and reader/export/alert parity.

Revision 4 adds 26 editable Include tags (497 total). The Sector bellwethers group
contains Adobe, Salesforce, ServiceNow, networking/chip/AI-infrastructure names,
Equinor and major retail/housing context. Separate tags cover private credit,
energy, widespread market disruption and trade deals. Existing aliases cover
factory output, import/export prices, ZEW/NAHB, job cuts/pay growth, neoclouds,
Europe gas, drilling rigs, DJI and Bab al-Mandeb spelling. No provider or body
fetching change is needed. A vague company-move headline qualifies as Included;
it does not prove an unseen macro driver or automatically gain Priority.

Verified RBNZ OCR hold/change releases qualify as cash-rate decisions. Explicit
numeric completed OCR decisions can receive Priority; previews retain the usual
guards. Selected official credit, lending, investment, housing and energy series
are retained; unrelated official health/admin releases do not gain blanket trust.

Narrow guards reject broker CFD/discount promotions, stock-overview/category pages,
placeholder pages and boilerplate daily single-stock performance recaps without
an explicit material driver. Dollar Tree/General, ordinary "rut", a quoted price,
sales/clinical pipelines and exchange/analyst attribution are not sufficient target
subjects. Material earnings, governance, export restrictions and reported company
news stay eligible. New countries in the editable other-market list reduce local
macro noise; explicit target-market fiscal, currency, energy and systemic context
still protects spillovers. No broad user Exclude blacklist is seeded.

The incremental upgrade appends only new terms to broad preset-based profiles
(at least 75% of the previous vocabulary). It preserves removed older tags and
custom additions; empty, short curated and full-capacity lists are unchanged.
Existing custom Exclude, provider selections, Trading relevance opt-out, delivery
mode, publication-age limit and credentials are preserved. Browser and server
retain before-relevance-v4 backups for version-3 profiles. Only an untouched old
other-market list is extended; customized policy lists remain unchanged. Revision
4 does not repeat the old version-3 sound-mode migration or replay consumed alerts.
