"""Trading mechanisms in headlines and source-provided summaries.

Signals describe why something deserves attention, not whether an event is
confirmed or a trade will work. Research, scenarios and price reactions can all
contain useful information. Explicit user exclusions are handled by relevance.
"""
from functools import lru_cache
import re

from .rules import normalized

BANKS = r'(?:fed|fomc|ecb|boe|boj|boc|rba|rbnz|snb|pboc|central banks?|federal reserve|bank of (?:england|japan|canada)|reserve bank of (?:australia|new zealand)|swiss national bank)'
_target = re.compile(r'\b' + BANKS + r'\b|\b(?:usd|eur|gbp|jpy|chf|cad|aud|nzd|dxy|greenback|dollars?|euro|sterling|british pound|yen|swiss franc|gold|silver|bullion|brent|wti|crude|oil|natural gas|treasur\w*|bunds?|gilts?|jgb|nasdaq|s&p|dow|nikkei|topix|dax|ftse|asx|stoxx)\b')
_wide = re.compile(r'\b(?:global|world|wall street|equities|equity|stocks|stock (?:markets?|sell[ -]?off|rout)|bond markets?|financial markets?|tech|ai|artificial intelligence|semiconductors?|chips?|banks|megabanks|banking|lenders|credit|fixed[ -]income)\b')
_risk = re.compile(r'\b(?:risk[ -](?:on|off)|risk (?:appetite|aversion|sentiment)|flight (?:from risk|to (?:safety|quality))|safe[ -]haven|haven (?:bid|demand|flows)|carry[ -]trade(?:s)?|capital (?:rotation|flight)|forced (?:selling|deleveraging)|contagion)\b')
_rotation = re.compile(r'\b(?:rotation|rotat\w*|flows? (?:into|out of|away from)|shifting .{0,35}(?:away from|into)|(?:slash\w*|cut\w*|unwind\w*) .{0,35}(?:tech bets|equity exposure))\b')
_stress = re.compile(r'\b(?:bank runs?|banking crisis|sovereign default|credit (?:risks?|stress|crunch|freeze|test)|funding (?:stress|crisis|gap|shortfall|pressure)|liquidity (?:stress|crisis|crunch)|financial stability|margin (?:calls|requirements)|emergency (?:liquidity|bailout)|redemptions|forced deleveraging|debt repric\w*|debt reprices)\b')
_credit = re.compile(r'\b(?:debt|credit|funding|financing|liquidity|collateral|leverage|deleveraging|at1)\b')
_strain = re.compile(r'\b(?:stress|risk\w*|worsen\w*|curb\w*|offload\w*|tighten\w*|deteriorat\w*|repric\w*|backlash|forced|shortfall|squeeze|exposure|cuts?|slashes?)\b')
_policy = re.compile(r'\b(?:hawkish|dovish|tighten\w*|easing|negative rates|(?:rate|rates)[ -](?:hikes?|cuts?|rises|increases|reductions)|(?:further|more|several|additional|half.point) (?:rate )?(?:hikes?|cuts?)|(?:raising|lowering) (?:key )?rates|(?:hikes?|cuts?) (?:of )?(?:more than )?\d+|\d+[ -]?(?:bp|bps|basis[ -]point) .{0,20}(?:hike|cut)|yield curve control|quantitative (?:easing|tightening)|minimum reserves|easing bets|inflation risks? .{0,35}upside)\b|\b' + BANKS + r"(?:'s)? hikes?\b|\brate (?:may|might) need to rise\b")
_rates = re.compile(r'\b(?:real (?:interest )?(?:rates|yields)|(?:rate|yield|swap) differentials|swap spreads|term premium|front[ -]end (?:rates|yields)|(?:us|treasury|jgb|bund|gilt) yields|yield support|(?:rate|hike|cut) (?:bets|odds|expectations|outlook)|(?:fed|ecb|boe|boj|rba|rbnz|snb|boc) (?:pricing|repricing)|policy divergence)\b')
_change = re.compile(r'\b(?:repric\w*|ris\w*|fall\w*|jump\w*|drop\w*|surge\w*|widen\w*|narrow\w*|shift\w*|eras\w*|trim\w*|ramp\w*|wrong\w*|incompatib\w*|support\w*|weigh\w*|fuel\w*|draw\w*|grow\w*|cut\w*|peaking|priced|pressure|outlook|forecast|bets|odds)\b')
_position = re.compile(r'\b(?:positioning|short squeeze|short covering|crowded|speculative (?:longs|shorts)|big short|pain trade|risk reversals|exposure reaches an extreme)\b')
_commodity = re.compile(r'\b(?:oil|crude|brent|wti|opec|iea|eia|gas|lng|gold|silver|bullion|metals|copper|iron ore|platinum|palladium)\b')
_supply = re.compile(r'\b(?:inventor\w*|supply|surplus|shortage|glut|oversupply|physical demand|industrial demand|demand (?:forecast|slump|sags|declin\w*)|production cuts?|output cuts?|exports? .{0,30}(?:falls?|low|halts?|cuts?)|central bank .{0,20}(?:demand|buy\w*|gold)|etf .{0,20}(?:flows|inflows|outflows)|lease rates|vaults)\b')
_broad_move = re.compile(r'\b(?:sell[ -]?off|rout|panic|crash\w*|bear market|correction|worst (?:day|week)|volatility|disruptions)\b')
_trade = re.compile(r'\b(?:tariffs?|export (?:curbs|controls|restrictions|bans?)|chip (?:curbs|controls|bans?)|trade (?:deal|truce|agreement)|capital controls|sanctions|blockade)\b')
_state = re.compile(r'\b(?:us|u\.s\.|united states|uk|britain|europe|eu|european|canada|canadian|carney|australia|australian|new zealand|japan|japanese|china|chinese|washington|commerce|trump)\b')
_fiscal = re.compile(r'\b(?:fiscal|sovereign|government debt|budget deficit|credit rating|rating at aa|public finances|tpi|transmission protection instrument)\b')
_macro = re.compile(r'\b(?:inflation|cpi|pce|ppi|payrolls|unemployment|labour|labor|jobs data|employment|gdp|economic growth|economy|macro resilience|business confidence|recession|stagflation|disinflation|industrial production|factory output|retail sales|home sales|mortgage rates|pmi|ism|monetary policy|mandate|central bank communications|power market)\b')
_economy = re.compile(r'\b(?:us|u\.s\.|united states|uk|british|eurozone|euro area|europe|german|japan\w*|swiss|canad\w*|australi\w*|new zealand|china|chinese)\b')
_future_statement = re.compile(r'\b(?:could|may|might|expected to|set to) (?:warn|signal|announce|say|urge|call|issue)\b')
_historical = re.compile(r'\b(?:last|previous) (?:meeting|decision|month|year)|\btelegraphed\b|\b(?:in|since) 20\d\d\b')
_publisher = re.compile(r'\s+-\s+(?:Reuters|Bloomberg(?:\.com)?|Investing\.com(?:\s+[\w ]+)?|Financial Times|FXStreet|WSJ|MarketWatch|Barron.?s|Seeking Alpha|(?:bne )?IntelliNews(?: Lambda)?|CNBC|Kitco)\s*$', re.I)
_static_pricing = re.compile(r'(?:' + BANKS + r' hike is (?:around )?\d+(?:\.\d+)?% priced|markets expect ' + BANKS + r' hike|markets implied .{0,80}chance of .{0,50}' + BANKS + r' hike)')


@lru_cache(maxsize=8192)
def market_signal(title, summary=''):
    """Return (explanation, Priority-1 candidate) from supplied text only."""
    text = normalized(_publisher.sub('', title) + '\n' + _publisher.sub('', summary))
    text = re.sub(r'\bfed up\b', 'frustrated', text)
    target, wide = bool(_target.search(text)), bool(_wide.search(text))
    reason = ''
    if _risk.search(text):
        reason = 'Risk sentiment, safe-haven or carry-trade context'
    elif _rotation.search(text) and (target or wide):
        reason = 'Cross-asset capital rotation or flows'
    elif _stress.search(text):
        reason = 'Credit, liquidity or financial-stability risk'
    elif re.search(r'\b(?:banks|megabanks|lenders)\b', text) and _strain.search(text) and re.search(r'\b(?:data.cent(?:re|er)|ai|property|real estate)\b', text):
        reason = 'Bank exposure to sector financing risk'
    elif _credit.search(text) and _strain.search(text) and wide:
        reason = 'Changing credit or financing conditions'
    elif (target or _economy.search(text)) and (_policy.search(text) or _rates.search(text) and _change.search(text)):
        reason = 'Monetary policy or rate-path repricing'
    elif (target or wide) and _position.search(text):
        reason = 'Positioning, crowding or short-covering risk'
    elif _commodity.search(text) and _supply.search(text):
        reason = 'Commodity supply, demand or inventory context'
    elif wide and _broad_move.search(text):
        reason = 'Broad-market stress or changing risk conditions'
    elif _trade.search(text) and (_state.search(text) or _commodity.search(text)):
        reason = 'Trade policy or cross-border restrictions'
    elif _fiscal.search(text) and (target or _economy.search(text)):
        reason = 'Sovereign or fiscal risk context'
    if reason:
        # A future speech is still useful context, but has not happened yet.
        context_only = (not summary and _static_pricing.fullmatch(normalized(title)))
        return reason, not bool(context_only or _future_statement.search(normalized(title)) or _historical.search(normalized(title)))
    if (target or _economy.search(text)) and _macro.search(text):
        return 'Target-market economic or policy context', False
    if wide and re.search(r'\b(?:yields|valuations|asset allocation)\b', text):
        return 'Cross-asset valuation context', False
    return '', False
