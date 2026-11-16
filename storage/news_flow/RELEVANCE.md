# Trading relevance

News Flow targets USD, EUR, GBP, JPY, CHF, CAD, AUD and NZD; Brent, gold/silver,
and broad stock indices. Other commodities, China, bonds, index companies and
geopolitics matter as transmission channels. Relevance is not a volatility,
direction, probability or trade-entry prediction. No article bodies or AI calls.

## One decision, all delivery paths

`relevance.py` decides relevance; `importance.py` decides the reading tier. `relevance.json` owns the editable seed (471
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
  open browser. Off / Included / All remain separate device delivery choices.
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

Priority / Included / Excluded are disjoint reading/export scopes. The boolean
included means relevant at either Priority or Included level; Included alarms
select both. Explicit Exclude overrides stars. Other manual stars can promote
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
