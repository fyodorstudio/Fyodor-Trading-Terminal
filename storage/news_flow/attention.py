"""Keep useful research readable while reserving P1 for clear market mechanisms."""
import re

from .rules import normalized
from .signals import BANKS

_fx = re.compile(r'\b(?:usd|eur|gbp|jpy|chf|cad|aud|nzd|dxy|greenback|dollar|euro|sterling|pound|yen|franc)\b')
_bank = re.compile(r'\b' + BANKS + r'\b')
_stress = re.compile(r'\b(?:funding (?:stress|crisis)|credit (?:stress|test|crunch|freeze)|financial stability|financial system|bank run|liquidity crisis|(?:sovereign|bank|debt|bond) default|forced deleveraging|forced (?:retail )?liquidation|debt repric\w*|debt reprices|debt exposure|financing fears)\b|\b(?:banks|investors)\b.{0,45}\bwary\b.{0,30}\b(?:debt|credit)\b|\b(?:rout|sell[ -]?off)\b.{0,30}\bspreads? to credit\b')
_risk = re.compile(r'\b(?:risk[ -](?:off|on|aversion|averse)|risk appetite|risk aversion|safe[ -]havens?|haven (?:demand|flows|bid)|flight (?:from risk|to (?:safety|quality))|carry[ -]trades?|intervention|sentiment (?:improves?|brightens?))\b')
_fresh = re.compile(r'\b(?:repric\w*|trim\w*|ramp\w*|surpris\w*|unexpected\w*|surge\w*|plung\w*|spik\w*|sink\w*|shock\w*|correction|diverg\w*|narrows?|widens?|cut\w*|shift\w*|changes?|new|adds?|added|revis\w*|raises?|raised|signals?|warns?|says?|said|announces?|debated)\b')
_market = re.compile(r'\b(?:(?:global|asian|european|us|world) (?:markets|stocks|equities)|wall street|stock (?:markets?|rout|selloff)|bond markets?|metals markets?|stocks|equities|s&p|nasdaq|nikkei|dow|ftse|dax|tech (?:stocks|rout|selloff)|chip (?:stocks|giants)|taiwan stocks)\b')
_move = re.compile(r'\b(?:rebound\w*|recover\w*|rall\w*|surge\w*|jump\w*|gain\w*|climb\w*|soar\w*|advance\w*|rises?|rising|plung\w*|plummet\w*|fall\w*|fell|drop\w*|slid\w*|slide\w*|sink\w*|tumble\w*|crash\w*|deepens?|spreads?|wipes?|wipeout|eras\w*|explod\w*|worsen\w*|join\w*|tally losses|losing streak|worst (?:day|week)|selloff resumes|selloff deepens|dump\w*|buy stocks|buying stocks|sell stocks|bear market|(?:into|enter|head for) (?:a )?correction)\b')
_preview = re.compile(r'\b(?:brace for|braces for|ahead of|await\w*|before|next test|all eyes|eyes on|what .{0,30}watch|what to expect|to face scrutiny|earnings preview)\b')
_opinion = re.compile(r'^(?:opinion\b|can everyday investors|how sustainable)|\b(?:overdone|bargains?|reason to buy|nearing an end|avoid a \d+% drawdown|overlooks good news|predicts? \d+|forecaster predicts|price forecast|technical analysis|elliott wave|podcasts?|funds hold a .{0,25}gain)\b')
_company_process = re.compile(r'\b(?:ipo|fundraisers?|fundraising|(?:mulls|weighs|plans|targets) .{0,30}(?:bond sale|issuance)|second[ -]quarter earnings)\b')
_calendar = re.compile(r'^(?:what are the main events|week ahead|the week ahead|economic calendar)|\beconomic data dump\b')
_static_reaction = re.compile(r'^(?:gold|silver|bullion|euro|dow jones|tsx futures)\b(?!:)|\bprice forecast\b')
_continuation = re.compile(r'\b(?:remains?|still|on track|holds? decline|support|headwind|ahead of|before|await\w*|brace\w*|weigh\w*|fears|face\w* .{0,20}test|outlook)\b')


def extra_context(title, summary):
    """Google descriptions often just repeat the title with different punctuation."""
    key = lambda value: ' '.join(re.sub(r'[^\w\s]', ' ', normalized(value)).split())
    headline, supplied = key(title), key(summary)
    return summary if supplied and not (supplied in headline or headline in supplied) else ''


def irrelevant_format(title):
    """Unambiguous advice/personnel formats, not a blanket research exclusion."""
    text = normalized(title)
    if re.search(r'\b(?:can everyday investors beat the pros|stock funds hold a .{0,25}gain for 20\d\d)\b', text):
        return 'retail investing advice or fund performance recap'
    if re.search(r'\b(?:guide|investing|trading)\b.{0,70}\bfor beginners\b', text):
        return 'introductory investing education'
    if re.search(r'\b(?:recruits?|taps?|appoints?|hires?)\b.{0,100}\b(?:to run|to head|co-cio)\b.{0,75}\bsovereign wealth fund\b', text):
        return 'routine fund executive appointment'
    return ''


def clear_attention(title, summary, reason):
    """A mechanism match establishes relevance; weak formats need stronger evidence."""
    headline = normalized(title)
    text = normalized(title + ' ' + summary)
    # Currency/haven scenarios and actual credit trouble are valuable even in
    # research or technical articles. Never require a realised price move here.
    protected = bool(_fx.search(text) and _risk.search(text) or _stress.search(text)
                     or _bank.search(text) and _fresh.search(text) and re.search(r'\b(?:hedge funds|sovereign bonds|financial|funding)\b', text)
                     or re.search(r'\b(?:major .{0,15}banks|payment systems|clearing systems)\b', text) and re.search(r'\b(?:outages?|disruptions|halt\w*)\b', text)
                     or _fx.search(headline) and re.search(r'\b(?:stock rout|ai sell[ -]?off|tech sell[ -]?off)\b', headline) and re.search(r'\b(?:boost\w*|dent\w*|support\w*|weigh\w*|drag\w*|pares losses)\b', headline))
    if reason in ('Geopolitical escalation, restraint or de-escalation',
                  'Changing risk appetite or safe-haven demand',
                  'FX intervention risk or official currency warnings',
                  'Managed-currency policy or fixing surprise',
                  'Strategic energy shipping or supply recovery'):
        return True
    if protected:
        return True
    if _calendar.search(headline):
        return False
    if irrelevant_format(title) or _opinion.search(headline):
        # A fresh central-bank/credit development supplied in the summary can
        # rescue an otherwise generic title; repeating the title cannot.
        extra = normalized(extra_context(title, summary))
        return bool(extra and _bank.search(extra) and _fresh.search(extra))
    if _fx.search(text) and _fresh.search(text) and re.search(r'\b(?:rate|yield|swap)\b', text):
        return True
    if _company_process.search(headline):
        return bool(_bank.search(text) and _fresh.search(text))
    if reason == 'Broad-market stress or changing risk conditions':
        return bool(_market.search(text) and _move.search(text) and not _preview.search(headline))
    if reason == 'Cross-asset capital rotation or flows' and re.search(r'\b(?:bet on|bets on|sees?|says?|recommends?)\b', headline):
        return bool(re.search(r'\b(?:fund flows|outflows|inflows|fund managers|positioning|record|fastest)\b', text))
    if reason == 'Central-bank guidance, liquidity or policy risk' and re.search(r'\bindependence\b', headline):
        return bool(re.search(r'\b(?:threat|attack|fired|dismiss|remov|resign|interfer|lawsuit|court|mandate chang)\w*', text))
    if reason == 'Trade policy or cross-border restrictions' and re.search(r'\b(?:will try|rebukes?|critici\w*|likely to spur|wants|calls for)\b', headline):
        return False
    if reason == 'Trade policy or cross-border restrictions' and headline.startswith('commentary:') and not re.search(r'\b(?:announc\w*|impos\w*|enact\w*|lift\w*)\b', headline):
        return False
    if reason == 'Monetary policy or rate-path repricing':
        if re.search(r'\b(?:hold looks entrenched|hasn.t cooled off|to keep .{0,20}on track)\b', headline):
            return False
        if _static_reaction.search(headline) and not _bank.match(headline):
            action = re.search(r'\b(?:signals?|announces?|repric\w*|surpris\w*|hawkish (?:remarks|comments)|rate (?:hikes|cuts) by|hike odds (?:jump|surge|rise to))\b', text)
            if not action and (_continuation.search(headline) or re.search(r'\b(?:elevated yields|strong dollar|rate expectations|rate hike odds|rate.hike bets)\b', headline)):
                return False
    if reason == 'Growth, labour or inflation repricing context' and _preview.search(headline) and not _bank.search(headline):
        released = re.split(r'\b(?:ahead of|before|await\w*)\b', headline, maxsplit=1)[0]
        return bool(re.search(r'\b(?:payrolls|cpi|pce|ppi|gdp|unemployment|jobless claims|retail sales)\b', released) and _fresh.search(released))
    return True
