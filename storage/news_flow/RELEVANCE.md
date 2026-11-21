# Trading relevance

News Flow targets eight major currencies, Brent, gold/silver and broad stock
indices. Related policy, bonds, companies, commodities and geopolitics qualify
when the headline connects them to those markets.

## Implementation

`relevance.py` classifies headlines; `priority.py` selects strict Priority 1
catalysts and `importance.py` combines that result with manual stars. `relevance.json` owns tag defaults, aliases and context patterns.
`headline_filters.py` recognizes explicit catalysts and routine headline formats;
`rules.py` handles literal matching and normalization. The frontend imports shared
defaults and displays the backend result rather than running a second classifier.

Classification runs before counting, pagination, copying and alert selection.
Desktop and phone use the same rules. Priority 1 and Priority 2 are separate
reader/export tiers; Excluded contains the rest. All remains available for browsing.

## Decision order

1. Explicit Exclude wins.
2. Official central-bank policy/speech and statistical releases can qualify without
   a literal Include hit. Source checks use article/feed domains or dedicated
   Google site scopes, rather than editable provider names. Administrative content
   does not receive this protection.
3. The routine filter excludes technical forecasts, recurring previews/recaps,
   analyst currency outlooks, stock recommendations, ordinary company results/deals
   and personality stories. Explicit intervention warnings, policy guidance,
   economic surprises and cross-market shocks remain eligible. Material company
   guidance changes, funding problems and leadership exits remain eligible too.
4. Target-country financial commentary and configured speaker aliases can qualify
   with policy context.
5. Strong target terms can qualify directly. Broad tags such as country names,
   AI, earnings and guidance need market context.
6. Topic guards exclude crypto-only prices, local retail metal quotes, non-market
   topics and unrelated domestic-market stories. Cross-market exceptions keep
   relevant policy, energy, metals, index companies and systemic events included.

Priority 1 requires direct headline evidence of FX intervention warnings/readiness,
specific central-bank rate guidance, major economic surprises, actual policy/trade
changes, physical energy-supply shocks, systemic stress or exceptional index moves.
Reported index moves qualify at 3% and VIX moves at 20%; exchange-listing labels
and another asset's percentage move do not establish an index shock. These
thresholds live in `priority.py`.

Routine rate odds, expected holds, analyst predictions, generic inflation remarks,
price-reaction articles, recaps and historical intervention reports stay out of
Priority 1. Official-source protection establishes relevance, not Priority 1.
Ambiguous relevant news stays in Priority 2. No price confirmation is needed for
an explicit qualifying catalyst; priority is not a prediction of price direction.

Publisher suffixes and reporting attributions are removed for contextual matching. Currency pairs, Unicode
punctuation and common stock/bond/yield forms normalize consistently. Literal mode
is available by turning off Trading relevance.

## User controls

Global settings expose Include/Exclude tags, automatic filter switches, other-market
keywords and cross-market exceptions. The headline checker previews the backend
result. Reset affects automatic filters only. Settings upgrades retain custom
lists, removed tags, selected providers and notification choices.

“Hide routine news and technical commentary” controls the new routine exclusions.
Disabling it restores broader keyword-based reading; disabling Trading relevance
restores literal matching. Manual stars can promote filtered stories unless an
explicit Exclude matches. All preserves collected stories and provider collection
is unaffected. The All notification mode intentionally bypasses relevance filters;
use Priority 1 only for strict alerts or Priority 1 + Priority 2 for broader alerts.

Off / Priority 1 only / Priority 1 + Priority 2 / All and publication-age limits are
shared by desktop and Android. Existing delivery selections remain saved. The API
retains `priority` and `included` identifiers for compatibility; `included` delivery
means both priorities, while the `included` reader/export mode means Priority 2 only.
Priority 1-only delivery suppresses identical publisher-normalized titles for two
hours across polling batches and URLs. Changed numbers/periods remain eligible;
different wording about the same event can still produce another alert.
Changing rules keeps the arrival cursor; it does not replay historical alerts.
Desktop sound and popup permissions remain local to the browser.

## Tests

`storage/news_flow/tests/test_relevance.py` covers classification and checks that
reading, copying and notifications agree. JSON fixtures in that directory hold
regression cases. UI coverage lives in
`frontend/src/news-flow/tests/test_news_relevance.mjs`.

The classifier uses headlines and source context, so ambiguous titles can still
be missed or over-included. All/Excluded are available when reviewing results.
