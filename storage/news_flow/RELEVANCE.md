# Trading relevance

News Flow targets eight major currencies, Brent, gold/silver and broad stock
indices. Related policy, bonds, companies, commodities and geopolitics qualify
when the headline or source-provided feed summary connects them to those markets.

## Implementation

`relevance.py` classifies supplied feed text; `signals.py` recognizes trading
mechanisms and `priority.py` selects Priority 1. `importance.py` combines that
result with manual stars. `relevance.json` owns tag defaults, aliases and context patterns.
`attention.py` separates clear mechanisms from routine formats; `publication.py`
checks dated sessions and old monthly release periods. `headline_filters.py`
recognizes explicit catalysts and routine headline formats;
`rules.py` handles literal matching and normalization. The frontend imports shared
defaults and displays the backend result rather than running a second classifier.

Classification runs before counting, pagination, copying and alert selection.
Desktop and phone use the same rules. Priority 1 and Priority 2 are separate
reader/export tiers; Excluded contains the rest. Reading checkboxes combine tiers
before counts, pagination and copying; they do not change the alert trigger.

## Decision order

1. Explicit Exclude wins.
2. Official central-bank policy/speech and statistical releases can qualify without
   a literal Include hit. Source checks use article/feed domains or dedicated
   Google site scopes, rather than editable provider names. Administrative content
   does not receive this protection.
3. Fundamental, risk, policy-pricing and cross-asset content protects a story
   from routine-format exclusion. Analyst attribution, technical levels, recap
   formatting and conditional language do not override useful mechanisms.
   Pure technical forecasts, stock picks, ordinary company results/deals and
   personality stories can still be excluded. Material company guidance changes,
   funding problems and leadership exits remain eligible too.
4. Target-country financial commentary and configured speaker aliases can qualify
   with policy context.
5. Strong target terms can qualify directly. Broad tags such as country names,
   AI, earnings and guidance need market context. A broad preset-based Include
   profile also recognizes trading mechanisms without a literal ticker match.
   Short curated Include lists retain their keyword scope. Feed summaries can
   establish relevance; explicit Exclude continues to match the original headline.
6. Topic guards exclude crypto-only prices, local retail metal quotes, non-market
   topics and unrelated domestic-market stories. Cross-market exceptions keep
   relevant policy, energy, metals, index companies and systemic events included.

Priority 1 keeps clear currency and cross-asset mechanisms: FX intervention,
hawkish/dovish policy and rate-path repricing, risk appetite/aversion, haven flows,
carry unwinds, capital rotation, positioning, credit/liquidity stress, trade/fiscal
risk and commodity supply/demand. Research and conditional scenarios can qualify;
the reason label describes their mechanism without claiming a confirmed event.
Both risk-on and risk-off developments matter, including information that challenges
a thesis. Iran strike restraint, oil risk-premium unwinds, shipping recovery and
direct currency/haven responses qualify without manual stars. Routine price targets,
technical recaps, previews and investment opinions stay in Priority 2 unless their
supplied context establishes a clear FX/risk, credit or fresh policy mechanism.
Retail investing advice and routine fund executive appointments can be Excluded.
Mentioning a selloff, volatility or an IPO does not by itself establish P1 urgency.
Monetary easing/tightening needs a rates, inflation or central-bank context;
corporate fiscal years and sovereign-fund recruitment are not fiscal shocks.

FX coverage includes intervention-watch developments, sovereign yield and auction
stress, central-bank guidance on liquidity/reserve tools, inflation corrections
and expectations, and material labour/growth changes. Strategic shipping attacks
and market-wide restrictions on major equity markets can qualify through their
cross-asset impact. Routine auction schedules, unchanged settings and small daily
fixing updates remain context. A PBOC fixing at least 0.25% away from the published
estimate qualifies; changes from the previous fixing alone do not. Comparisons
such as "biggest move since 2025" describe current news, not historical events.

Explicit policy/data surprises, energy shocks and exceptional index moves also
qualify. The fallback index thresholds in `priority.py` (3%, or 20% for VIX) are
not prerequisites for recognizing risk sentiment or cross-asset transmission.
Other relevant context remains Priority 2. No price confirmation is required;
priority does not verify direction or information novelty. Source-provided
summaries use at most 8,000 characters; article bodies are not fetched.

An explicitly dated session conflicting with the feed date, or an unusually old
monthly inflation/budget period, cannot automatically reach P1. Stated corrections,
revisions and delayed releases remain eligible, as do manual stars. The date context
is shared by reader counts, export, configured desktop arrivals, phone and the
headline checker (optional `published_at`). This does not reconstruct historical
publisher revisions or repair ambiguous Google dates; historical headlines are not
a verified point-in-time tape. Existing stored publication dates are not rewritten.

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
use Priority 1 only for important trading context or both priorities for broader alerts.

Off / Priority 1 only / Priority 1 + Priority 2 / All and publication-age limits are
shared by desktop and Android. Existing delivery selections remain saved. The API
retains `priority` and `included` identifiers for compatibility; `included` delivery
means both priorities, while the `included` reader/export mode means Priority 2 only.
Priority 1-only delivery suppresses identical publisher-normalized titles for two
hours across polling batches and URLs. Changed numbers/periods remain eligible;
different wording about the same event can still produce another alert.
The P1-only reader and its copy/export also collapse identical publisher-normalized
headlines within each UTC publication day. Changed figures/directions, manual
research stars and summary-only mechanisms stay independent. Combined reading,
P2 and All preserve the wider research view.
Changing rules keeps the arrival cursor; it does not replay historical alerts.
Desktop sound and popup permissions remain local to the browser.

## Tests

`storage/news_flow/tests/test_relevance.py` covers classification and checks that
reading, copying and notifications agree. JSON fixtures in that directory hold
regression cases. UI coverage lives in
`frontend/src/news-flow/tests/test_news_relevance.mjs`.

The classifier uses headlines and source context, so ambiguous titles can still
be missed or over-included. All/Excluded are available when reviewing results.
