# Trading relevance

News Flow targets eight major currencies, Brent, gold/silver and broad stock
indices. Related policy, bonds, companies, commodities and geopolitics qualify
when the headline connects them to those markets.

## Implementation

`relevance.py` classifies headlines; `importance.py` assigns Priority and handles
manual stars. `relevance.json` owns tag defaults, aliases and context patterns.
`rules.py` handles literal matching and normalization. The frontend imports shared
defaults and displays the backend result rather than running a second classifier.

Classification runs before counting, pagination, copying and alert selection.
Desktop and phone use the same rules. Included contains Priority and other relevant
headlines; Excluded contains the rest. All remains available for browsing.

## Decision order

1. Explicit Exclude wins.
2. Official central-bank policy/speech and statistical releases can qualify without
   a literal Include hit. Source checks use article/feed domains or dedicated
   Google site scopes, rather than editable provider names. Administrative content
   does not receive this protection.
3. Target-country financial commentary and configured speaker aliases can qualify
   with policy context.
4. Strong target terms can qualify directly. Broad tags such as country names,
   AI, earnings and guidance need market context.
5. Topic guards exclude crypto-only prices, local retail metal quotes, non-market
   topics and unrelated domestic-market stories. Cross-market exceptions keep
   relevant policy, energy, metals, index companies and systemic events included.

Publisher suffixes are removed for contextual matching. Currency pairs, Unicode
punctuation and common stock/bond/yield forms normalize consistently. Literal mode
is available by turning off Trading relevance.

## User controls

Global settings expose Include/Exclude tags, automatic filter switches, other-market
keywords and cross-market exceptions. The headline checker previews the backend
result. Reset affects automatic filters only. Settings upgrades retain custom
lists, removed tags, selected providers and notification choices.

Off/Included/All and publication-age limits are shared by desktop and Android.
Changing rules keeps the arrival cursor; it does not replay historical alerts.
Desktop sound and popup permissions remain local to the browser.

## Tests

`storage/news_flow/tests/test_relevance.py` covers classification and checks that
reading, copying and notifications agree. JSON fixtures in that directory hold
regression cases. UI coverage lives in
`frontend/src/news-flow/tests/test_news_relevance.mjs`.

The classifier uses headlines and source context, so ambiguous titles can still
be missed or over-included. All/Excluded are available when reviewing results.
