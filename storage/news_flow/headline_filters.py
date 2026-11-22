"""Headline evidence for unscheduled catalysts and common low-signal formats.

These rules do not infer article contents, market direction or information novelty.
The reader and both notification channels consume the same relevance decision.
"""
import re

from .rules import normalized
from .signals import market_signal
from .attention import extra_context, irrelevant_format

_bank = re.compile(r'\b(?:fed|fomc|ecb|boe|boj|boc|rba|rbnz|snb|central bank|federal reserve|bank of (?:japan|england|canada)|reserve bank of (?:australia|new zealand)|swiss national bank)\b')
_fx = re.compile(r'\b(?:yen|jpy|franc|currency|currencies|fx|forex|foreign exchange|exchange rate)\b')
_authority = re.compile(r'\b(?:japan|japanese (?:officials|authorities|finance minister)|tokyo|mof|finance minist\w*|currency (?:chief|diplomat)|snb|swiss national bank|boj|bank of japan)\b')
_warning = re.compile(r'\b(?:warns?|warnings?|(?:ready|prepared) to (?:act|intervene|take (?:decisive )?action)|won.t rule out|will not rule out|all options|rate checks?|(?:excessive|one-sided|disorderly|speculative)(?: \w+){0,2} (?:moves|movements))\b')
_intervention = re.compile(r'\b(?:interven\w*|rate checks?|excessive|one-sided|disorderly|speculative)\b')
_guidance = re.compile(r'\b(?:says?|said|signals?|warns?|urges?|calls? for|plans? to|expects?|noted|vows?|sees?)\b.{0,100}\b(?:faster|further|more|another|swift|nimble|continue|keep|pause|stop|halt|resume|delay|warrant|above neutral|overshoot)\b.{0,65}\b(?:hikes?|cuts?|tighten\w*|eas\w*|rates?|inflation|consideration)\b')
_data = re.compile(r'\b(?:cpi|pce|ppi|inflation|payrolls|nfp|gdp|unemployment|employment|jobless claims|jobs report|retail sales|home sales|industrial production|factory output|inventories|pmi|ism|philly fed|empire manufacturing|consumer sentiment|zew|ifo)\b')
_surprise = re.compile(r'\b(?:unexpectedly|surpris(?:e|es|ed)|(?:above|below|beats?|misses?) (?:[+-]?\d+(?:\.\d+)?%? )?(?:estimates|expectations|consensus|forecasts))\b')
_number = r'(?P<{}>[+-]?\d[\d,]*(?:\.\d+)?)\s*(?P<{}>%|percent|k|m|billion|million|thousand)?'
_comparison = re.compile(_number.format('actual', 'actual_unit') + r'\s*(?:(?:yoy|mom|qoq|in [a-z]+|in q[1-4])[, ]*){0,3}\s*[,;]?\s*(?:vs\.?|versus|against)\s*' + _number.format('forecast', 'forecast_unit') + r'\s*(?:expected|forecast|consensus|estimat\w*)\b')
_preview = re.compile(r'\b(?:preview|ahead of|awaits?|before|(?:expected|forecast) (?:to|at)|could|may|might)\b')

# An actual macro consequence can rescue an otherwise routine format. Merely
# mentioning the Fed, China or a ticker cannot do so.
_transmission = re.compile(r'\b(?:bank run|banking crisis|liquidity (?:crisis|stress)|funding (?:stress|crisis)|credit (?:freeze|crunch|stress)|capital shortfall|contagion|sovereign default|capital controls|emergency bailout|carry[ -]trade unwind\w*)\b|\b(?:nasdaq|s&p|global (?:stocks|equities)|stock markets?|equity markets?|tech stocks|chip stocks|semiconductor stocks|bond markets?)\b.{0,90}\b(?:sell[ -]?off|rout|plung\w*|crash\w*|slump\w*|wipeout|hammered)\b|\b(?:tariffs?|export (?:curbs|controls|ban|restrictions)|chip (?:curbs|controls|ban)|sanctions?|blockade|ceasefire|invasion|supply disruption|production (?:halt|cut)|refinery outage)\b')
_technical = re.compile(r'\b(?:price (?:news and )?forecast|elliott wave|resistance arc|bullish pattern|technical (?:analysis|outlook)|rsi|macd|fibonacci|fibo|\d+[ -]day (?:sma|ema|moving average)|\d+[ -]ema|retracement)\b')
_digest = re.compile(r'\b(?:news wrap|markets? wrap|market recap|weekly (?:forecast|outlook|preview)|week ahead|forex today|earnings preview|fx option expiries|am need to know)\b|^stock market news[, :]|^(?:gold|silver) price today\b')
_recommendation = re.compile(r'\b(?:stock price targets?|price target (?:cuts?|hikes?)|(?:raises?|cuts?|lifts?|lowers?|reiterates?|maintains?)\b.{0,65}\bprice targets?|(?:stocks?|shares?) to buy(?! into)|\d+ (?:best|top) stocks|(?:buy|sell|hold|overweight|underweight|outperform|underperform) rating|rating (?:cut|downgrade|upgrade)|must[ -]buy|reiterates?\b.{0,60}\bstock rating|biggest analyst calls|^top .{0,60}stocks)\b|\bcan rebound to \$\d')
_research = re.compile(r'^(?:us dollar|japanese yen|euro|british pound|swiss franc|canadian dollar|australian dollar|new zealand dollar|gold|silver|[a-z]{3}[ /][a-z]{3}):')
_analyst = re.compile(r'\s+[–—-]\s+(?:uob|ing|bbh|ocbc|bny|td securities|commerzbank|mufg|societe generale|standard chartered|danske bank|ubs|goldman sachs|morgan stanley|wells fargo)\s*$', re.I)
_corporate = re.compile(r'\b(?:earnings|eps|quarterly (?:results|revenue|profit)|profits?|acquir\w*|acquisition|merger|takeover|buyout|in talks to buy|explores sale|product launch|unveils? new|appoints?|names?\b.{0,50}\bceo|dividends?|share buybacks?)\b')
_company_change = re.compile(r'\b(?:cuts?|slashes?|withdraws?|lowers?|raises?|hikes?|lifts?)\b.{0,45}\b(?:guidance|outlook|revenue forecast|earnings forecast|capex|capital spending)\b|\b(?:resigns?|oust\w*|fraud|default|bankrupt\w*|(?:earnings|profit) (?:warning|collapse)|revenue delay|halts? (?:production|shipments)|funding (?:gap|shortfall)|financing constraints)\b|\bceo\b.{0,30}\b(?:crisis|emergency)\b')
_gossip = re.compile(r'\b(?:affair|apolog\w*|personal life|all-hands meeting|should return|return as ceo|return to nvidia|donate\w* to|misconduct allegations|divided workforce|comeback|reinstat\w*|rehir\w*|petition)\b')
_procurement = re.compile(r'\bbans?\b.{0,70}\bprocurement\b.{0,40}\bmisconduct\b')
_broad_market = re.compile(r'\b(?:wall street|nasdaq|s&p|dow jones|ftse|tsx|asx|nikkei|topix|dax|hang seng|euro stoxx|(?:us|u\.s\.|global|world|asian|european|japanese|tech|chip|semiconductor) (?:stocks|shares|equities)|stock futures|equity markets|stock markets)\b|^(?:stocks|shares|equities) (?:fall|dip|rise|slip|gain|plunge|drop|rally)\b')
_company_subject = re.compile(r'\b(?:shares?|ceo|company|firm|inc|corp|ltd|plc|quarterly (?:profit|revenue|results)|earnings call|dividends?)\b')
_price_subject = re.compile(r'^(?:[a-z]{3}[ /][a-z]{3}|us dollar(?: index)?|japanese yen|euro|british pound|swiss franc|canadian dollar|australian dollar|new zealand dollar|gold|silver|wti|brent|oil)\b')
_waiting = re.compile(r'\b(?:ahead of|awaits?|eyes?|eyed|eyeing|in focus|in the spotlight|before)\b')
_scheduled = re.compile(r'\b(?:cpi|pce|inflation data|jobs|employment|retail sales|gdp|pmi|ism|fomc|minutes|earnings|rate decision|speeches)\b')
_large_loss = re.compile(r'\b(?:lost|loses?|wipeout|erases?|sheds?)\b.{0,40}\$\d+(?:\.\d+)?\s*trillion\b')


def catalyst_reason(title):
    """Recognize explicit developments, without requiring a price reaction."""
    text = normalized(title)
    if '?' in text:
        return ''
    if _authority.search(text) and _fx.search(text) and _intervention.search(text) and re.search(r'\b(?:conducts?|conducted|confirms?|confirmed|intervenes?|intervened)\b', text):
        return 'Reported currency intervention or rate check'
    if _authority.search(text) and _fx.search(text) and _warning.search(text) and _intervention.search(text):
        return 'Official FX intervention warning or readiness · verify wording'
    if _bank.search(text) and _guidance.search(text) and not _analyst.search(title) and not re.search(r'\b(?:poll|economists|analysts|preview)\b|^(?:goldman sachs|ubs|morgan stanley)\b', text):
        return 'Reported central-bank guidance · verify policy context'
    # A headline can report a release and then preview a different event.
    release_text = re.split(r'\b(?:ahead of|awaits?|eyeing|eyes?)\b', text, maxsplit=1)[0]
    if _data.search(release_text):
        # "Few surprises" is not evidence of a surprise; previews are not releases.
        reported = re.sub(r'\b(?:no|few|little|without|not a) surprises?\b|\b(?:fails? to|does not) surprise\b|\bnot unexpectedly\b', '', release_text)
        reported = re.sub(r'\b(?:not|never|does not|did not|fails? to) (?:above|below|beats?|miss(?:es)?) (?:estimates|expectations|consensus|forecasts)\b', '', reported)
        if _surprise.search(reported) and not _preview.search(release_text):
            return 'Reported economic-data surprise'
        comparison = _comparison.search(release_text)
        if comparison and not _preview.search(release_text):
            actual_unit, forecast_unit = comparison['actual_unit'], comparison['forecast_unit']
            if actual_unit == forecast_unit and float(comparison['actual'].replace(',', '')) != float(comparison['forecast'].replace(',', '')):
                return 'Reported actual versus forecast difference'
    return ''


def routine_reason(title, company=False, summary=''):
    """Return a reason only for identified noise, keeping ambiguous news eligible."""
    text = normalized(title)
    irrelevant = irrelevant_format(title)
    if irrelevant and not market_signal('', extra_context(title, summary))[1]:
        return irrelevant
    if market_signal(title, summary)[0]:
        return ''
    if re.search(r'\bfed\b.{0,45}\b(?:staff|regional-bank staff)\b.{0,45}\bpay (?:increases|raises)|\bfed cuts pay raises\b', text):
        return 'central-bank internal personnel news'
    if re.search(r'\bsanctions (?:bid|motion)\b.{0,65}\b(?:evidence|court|lawsuit|cases)\b', text):
        return 'civil litigation without a market-wide catalyst'
    exceptional_move = _broad_market.search(text) and re.search(r'\b(?:worst|biggest|largest|steepest) (?:day|week|drop|fall|sell[ -]?off) since\b', text)
    if (catalyst_reason(title) or _transmission.search(text) or exceptional_move
            or company and _large_loss.search(text) or (_fx.search(text) and _intervention.search(text))):
        return ''
    if _technical.search(text):
        return 'technical forecast or indicator commentary'
    if _digest.search(text):
        return 'routine preview, recap or price bulletin'
    if _price_subject.search(text) and _waiting.search(text) and _scheduled.search(text):
        return 'price commentary ahead of a scheduled event'
    if _recommendation.search(text):
        return 'stock recommendation or price target'
    if _research.search(text) and _analyst.search(title):
        return 'routine analyst currency outlook'
    if _procurement.search(text):
        return 'routine corporate procurement notice'
    if re.search(r'^final trade:|\bcramer.{0,30}lightning round|\b(?:names?|appoints?)\b.{0,60}\b(?:board of directors|to (?:the )?board)\b', text):
        return 'routine stock picks or board appointment'
    if re.search(r'\b(?:people miss|tech elite lament|celebrate.{0,30}leadership|left the company in|tuned instagram|trademark dispute|concept for diy restaurants|would welcome.{0,40}return|key deals this week|global patent filings)\b', text):
        return 'corporate personality or product detail'
    if not _broad_market.search(text) and not _company_change.search(text):
        if company and _gossip.search(text):
            return 'corporate personality or promotional story'
        if (company or _company_subject.search(text)) and _corporate.search(text):
            return 'routine company results, deal or product news'
        if re.search(r'^why is .{0,70}\bstock (?:sliding|rising|rallying|falling) today', text):
            return 'single-stock explainer without a stated catalyst'
    return ''
