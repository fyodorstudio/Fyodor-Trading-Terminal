"""Conservative Priority 1 selection from explicit headline evidence."""
from functools import lru_cache
import re

from .headline_filters import catalyst_reason
from .rules import normalized

INDEX_SHOCK_PERCENT = 3
VIX_SHOCK_PERCENT = 20

_bank = r'(?:fed|fomc|ecb|boe|boj|boc|rba|rbnz|snb|central bank|federal reserve|bank of england|bank of japan|bank of canada|reserve bank of (?:australia|new zealand)|swiss national bank)'
_decision = re.compile(r'\b' + _bank + r"(?:'s)?\b.{0,65}?\b(?P<action>raises?|raised|hikes?|hiked|cuts?|cut|holds?|held|keeps?|kept|leaves?|left)\b.{0,45}\b(?:rates|(?:interest|cash|policy|deposit|benchmark|key|lending) rates?|borrowing costs?)\b")
_speculation = re.compile(r'\b(?:preview|opinion|forecasts?|predicts?|poll|economists?|analysts?|price targets?|expected to|set to|may|might|could|would|should|seeks?|hopes?|aims?|weighs?|considers?|unconfirmed)\b')
_retrospective = re.compile(r'\b(?:last|previous) (?:meeting|decision|month|year)|\btelegraphed\b')
_dated_intervention = re.compile(r'\b(?:in|since) (?:january|february|march|april|may|june|july|august|september|october|november|december)\b')
_research = re.compile(r'^(?:goldman sachs|ubs|morgan stanley|deutsche bank|barclays|commerzbank|societe generale)\b.{0,45}\b(?:forecasts?|predicts?|sees?|expects?|recommends?)\b|\s+[–—-]\s+(?:ing|uob|mufg|bbh|ocbc|bny|ubs|commerzbank|danske bank|deutsche bank|societe generale)\s*$', re.I)
_reaction = re.compile(r'^(?:[a-z]{3}[ /][a-z]{3}|us dollar(?: index)?|united states dollar(?: index)?|dollar|japanese yen|euro|british pound|pound sterling|swiss franc|canadian dollar|australian dollar|new zealand dollar|gold|silver|bullion|oil|crude|brent|wti|european gas|natural gas)\s+(?:(?:prices?|futures|index)\s+)?(?:falls?|drops?|declines?|gains?|rises?|rallies|rebounds?|slides?|slips?|steadies|holds?|trades?|edges?|finds?|softens?|weakens?|strengthens?|surges?|plunges?|slumps?|extends?|climbs?|stabiliz\w*|caught)\b')
_format = re.compile(r'\b(?:price (?:news and )?forecast|technical analysis|elliott wave|news wrap|markets? wrap|market news:|forex today|week ahead|podcast)\b|^the oil market\b')
_major_data = re.compile(r'\b(?:cpi|pce|inflation|payrolls|nfp|gdp|employment|unemployment|pmi|ism)\b')
_policy_action = re.compile(r'\b(?:(?:rate|rates) (?:hikes?|cuts?|increases?|reductions?)|(?:swift|nimble|further|more|another|gradual|faster|half[ -]point|quarter[ -]point) (?:rate )?(?:hikes?|cuts?)|hikes? (?:of )?(?:more than )?\d+(?:\.\d+)? (?:bps|basis points)|tighten\w*|easing|raising (?:key )?rates?|lowering rates|pause (?:rate|hikes|cuts)|stop (?:raising|cutting))\b')
_policy_statement = re.compile(r'\b(?:says?|said|urges?|calls? for|expects?|plans?|signals?|noted|vows?|thinks?|warns?)\b')
_policy_speaker = re.compile(r'^(?:(?:hawkish|dovish|st\. louis|cleveland|new york|boston|chicago)\s+)?' + _bank + r'\b|^waller\b.{0,30}\b' + _bank + r'\b')
_pricing_context = re.compile(r'\b(?:markets? (?:see|expect|price|believe)|bets on|(?:hike|cut|rate) (?:bets|odds)|priced in)\b')
_analyst_policy = re.compile(r'^(?:goldman sachs|ubs|morgan stanley|deutsche bank|barclays)\b.{0,60}\b(?:says?|sees?|expects?)\b.{0,50}\b' + _bank + r'\b')
_policy_shift = re.compile(r'\b(?:yield curve control|ycc|quantitative easing|quantitative tightening|balance sheet runoff|asset purchases|bond purchases|forward guidance)\b')
_change = re.compile(r'\b(?:ends?|ended|scraps?|scrapped|abandons?|abandoned|launches?|launched|halts?|halted|suspends?|suspended|doubles?|doubled|expands?|expanded|accelerates?|accelerated)\b')
_energy = re.compile(r'\b(?:opec|oil|crude|brent|hormuz|lng|natural gas|petroleum|fuel|refineries|tankers?)\b')
_supply = re.compile(r'\b(?:blockade|embargo|supply disruption|refinery outage|production cuts?|output cuts?|supply cuts?|halts? (?:production|exports|shipments)|suspends? (?:production|exports|shipments)|pipeline (?:closed|shut|disrupted)|tankers? (?:hit|attacked)|strikes?(?!\s+(?:\$\S+\s+)?deal\b)|attacks?|sea mines)\b')
_physical = re.compile(r'\b(?:opec|shipped|shipping|shipments?|exports?|production|output|refiner\w*|tankers?|pipeline|crew|vessel|embargo|blockade|hormuz closure)\b')
_conflict = re.compile(r'\b(?:iran|israel|hormuz|middle east|taiwan|russia|ukraine)\b')
_escalation = re.compile(r'\b(?:ceasefire (?:agreed|deal|begins|collapses)|agrees? (?:to )?(?:a )?ceasefire|peace deal (?:signed|agreed)|launches? (?:an? )?(?:missile|attack|invasion)|invades?|blockade|further attacks?.{0,30}unlikely|attacks?.{0,30}ruled out)\b')
_state = re.compile(r'\b(?:us|u\.s\.|united states|trump|china|chinese|eu|european union|european commission|uk|japan|canada|australia|government)\b')
_trade = re.compile(r'\b(?:tariffs?|export (?:curbs|controls|bans?|restrictions)|chip (?:curbs|controls|bans?)|trade embargo|capital controls|sanctions?)\b')
_enact = re.compile(r'\b(?:imposes?|announces?|implements?|enacts?|approves?|bans?|blocks?|restricts?|lifts?|scraps?|removes?|suspends?|tightens?|widens?|raises?|hikes?|cuts?|expands?)\b')
_state_action = re.compile(r'^(?:(?:breaking|update \d+)[: -]*)?' + _state.pattern + r"(?:'s)?\s+(?:(?:and \w+|government|administration|officials|authorities)\s+)?" + _enact.pattern)
_systemic = re.compile(r'\b(?:bank run|banking crisis|credit freeze|credit crunch|emergency bailout|sovereign default|liquidity crisis|funding crisis|capital controls|emergency liquidity)\b')
_index = re.compile(r'\b(?:nasdaq|s&p ?500|dow jones|global (?:stocks|equities)|nikkei|dax|ftse|vix)\b')
_shock = re.compile(r'^\s*(?:(?:100|250|500)\s+)?(?:index\s+)?(?:plung\w*|crash\w*|tumbles?|sinks?|falls?|drops?|surges?|jumps?)\s+(?:(?:more than|nearly|almost|over)\s+)?[+-]?(\d+(?:\.\d+)?)%')


@lru_cache(maxsize=8192)
def attention_reason(title):
    text = normalized(title)
    # Exchange listings are metadata, not evidence that the index itself moved.
    text = re.sub(r'\s*\([^)]*:[^)]*\)\s*$', '', text)
    future_statement = re.search(r'\b(?:could|may|might|expected to|set to) (?:warn|signal|announce|say|urge|call)\b', text)
    if '?' in text or _research.search(title) or _analyst_policy.search(text) or _format.search(text) or future_statement:
        return ''
    for index in _index.finditer(text):
        shock = _shock.search(text[index.end():])
        if shock and float(shock[1]) >= (VIX_SHOCK_PERCENT if index[0] == 'vix' else INDEX_SHOCK_PERCENT):
            return 'Reported exceptional broad-market move'
        if re.search(r'\b(?:circuit breaker|market-wide trading halt)\b', text):
            return 'Reported market-wide trading interruption'
    # Price reactions can remain useful Priority 2 context without repeating the
    # initial policy/data alert every time another market responds.
    if _reaction.search(text):
        return ''
    catalyst = catalyst_reason(title)
    if 'intervention' in catalyst or 'rate check' in catalyst:
        if not _retrospective.search(text) and not _dated_intervention.search(text) and not re.search(r'\b(?:preview|forecast|expected to|analysts?)\b', text):
            return catalyst
    if (_policy_speaker.search(text) and _policy_statement.search(text)
            and _policy_action.search(text) and not _retrospective.search(text)
            and not _pricing_context.search(text)
            and not re.search(r'\b(?:poll|economists?|analysts?|preview)\b', text)):
        return 'Reported specific central-bank policy guidance'
    major_release = _major_data.search(text) or re.search(r'\bretail sales\b', text) and re.search(r'\bunexpectedly\b', text)
    if catalyst in ('Reported economic-data surprise', 'Reported actual versus forecast difference') and major_release:
        return catalyst
    if re.search(r'\bocr (?:increased|reduced|cut|hiked)\b.{0,55}\d+(?:\.\d+)?%', text):
        return 'Reported official cash-rate change'
    if _speculation.search(text) or _retrospective.search(text):
        return ''
    policy = _decision.search(text)
    if policy and not re.search(r'\bas expected\b|\bminutes(?:\s+(?:show|reveal|from)|:)', text) and not re.search(r'\bto\s*$', text[:policy.start('action')]):
        prefix = text[:policy.start()].strip()
        if re.fullmatch(r"(?:(?:breaking|update \d+|japan's|canada's|australia's|uk's)[: -]*)?", prefix):
            return 'Reported central-bank rate decision'
    if re.search(r'\b' + _bank + r'\b', text) and _policy_shift.search(text) and _change.search(text):
        return 'Reported monetary-policy framework change'
    if _energy.search(text) and (_supply.search(text) or 'hormuz closure' in text) and _physical.search(text):
        return 'Reported energy-supply shock'
    if _conflict.search(text) and _escalation.search(text):
        return 'Reported geopolitical escalation or de-escalation'
    if _state_action.search(text) and _trade.search(text) and not re.search(r'\bif\b', text):
        return 'Reported government trade or capital restriction change'
    if _systemic.search(text):
        return 'Reported systemic financial stress'
    if re.search(r'\b(?:treasury|finance ministry)\b', text) and re.search(r'\bbuybacks?\b', text) and _change.search(text):
        return 'Reported Treasury funding/buyback change'
    return ''
