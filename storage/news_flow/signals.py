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
_risk = re.compile(r'\b(?:risk[ -](?:on|off|averse)|risk (?:appetite|aversion|sentiment)|flight (?:from risk|to (?:safety|quality))|safe[ -]havens?|haven (?:bid|demand|flows)|carry[ -]trade(?:s)?|capital (?:rotation|flight)|forced (?:selling|deleveraging)|contagion)\b')
_rotation = re.compile(r'\b(?:rotation|rotat\w*|flows? (?:into|out of|away from)|shifting .{0,35}(?:away from|into)|(?:slash\w*|cut\w*|unwind\w*) .{0,35}(?:tech bets|equity exposure))\b')
_stress = re.compile(r'\b(?:bank runs?|banking crisis|sovereign default|credit (?:risks?|stress|crunch|freeze|test)|funding (?:stress|crisis|gap|shortfall|pressure)|liquidity (?:stress|crisis|crunch)|financial stability|financial (?:system|sector) risks?|margin (?:calls|requirements)|emergency (?:liquidity|bailout)|redemptions|forced deleveraging|debt repric\w*|debt reprices)\b')
_credit = re.compile(r'\b(?:debt|credit|funding|financing|liquidity|collateral|leverage|deleveraging|at1)\b')
_strain = re.compile(r'\b(?:stress|risk\w*|worsen\w*|curb\w*|offload\w*|tighten\w*|deteriorat\w*|repric\w*|backlash|forced|shortfall|squeeze|exposure|cuts?|slashes?)\b')
_policy = re.compile(r'\b(?:hawkish|dovish|tighten\w*|easing|negative rates|(?:rate|rates)[ -](?:hikes?|cuts?|rises|increases|reductions)|(?:further|more|several|additional|half.point) (?:rate )?(?:hikes?|cuts?)|(?:raising|lowering) (?:key )?rates|(?:hikes?|cuts?) (?:of )?(?:more than )?\d+|\d+[ -]?(?:bp|bps|basis[ -]point) .{0,20}(?:hike|cut)|yield curve control|quantitative (?:easing|tightening)|minimum reserves|easing bets|inflation risks? .{0,35}upside)\b|\b' + BANKS + r"(?:'s)? hikes?\b|\brate (?:may|might) need to rise\b")
_rates = re.compile(r'\b(?:real (?:interest )?(?:rates|yields)|(?:interest )?(?:rate|yield|swap) differentials?|(?:interest )?(?:rate|yield) (?:gaps?|spreads?)|swap spreads|term premium|front[ -]end (?:rates|yields)|(?:us|treasury|jgb|bund|gilt) (?:\w+[ -]){0,3}yields?|yield support|(?:rate|hike|cut) (?:bets|odds|expectations|outlook)|(?:fed|ecb|boe|boj|rba|rbnz|snb|boc) (?:pricing|repricing)|polic(?:y|ies) (?:divergence|diverge)|(?:elevated|rising|falling) yields)\b')
_change = re.compile(r'\b(?:repric\w*|ris\w*|fall\w*|jump\w*|drop\w*|surge\w*|widen\w*|narrow\w*|shift\w*|eras\w*|trim\w*|ramp\w*|wrong\w*|incompatib\w*|support\w*|weigh\w*|fuel\w*|draw\w*|grow\w*|cut\w*|sink\w*|advance\w*|gains|worr\w*|peaking|priced|pressure|outlook|forecast|bets|odds|diverge)\b')
_position = re.compile(r'\b(?:positioning|short squeeze|short covering|crowded|speculative (?:longs|shorts)|big short|pain trade|risk reversals|exposure reaches an extreme)\b')
_commodity = re.compile(r'\b(?:oil|crude|brent|wti|opec|iea|eia|gas|lng|gold|silver|bullion|metals|copper|iron ore|platinum|palladium)\b')
_supply = re.compile(r'\b(?:inventor\w*|supply|surplus|shortage|glut|oversupply|brimming with crude|physical demand|industrial demand|demand (?:forecast|slump|sags|declin\w*|concerns|worries)|production cuts?|output cuts?|exports? .{0,30}(?:falls?|low|halts?|cuts?)|central bank .{0,20}(?:demand|buy\w*|gold)|etf .{0,20}(?:flows|inflows|outflows)|lease rates|vaults)\b')
_broad_move = re.compile(r'\b(?:sell[ -]?off|rout|panic|crash\w*|bear market|correction|worst (?:day|week)|volatility|disruptions|unravels?)\b')
_trade = re.compile(r'\b(?:tariffs?|export (?:curbs|controls|restrictions|bans?)|chip (?:curbs|controls|bans?)|trade (?:deal|truce|agreement)|capital controls|sanctions|blockade)\b')
_state = re.compile(r'\b(?:us|u\.s\.|united states|uk|britain|europe|eu|european|canada|canadian|carney|australia|australian|new zealand|japan|japanese|china|chinese|washington|commerce|trump)\b')
_fiscal = re.compile(r'\b(?:fiscal (?:risks?|policy|stress|pressure|stimulus|outlook|rules?|deficit|crisis|spending|health|discipline)|fiscally stressed|sovereign (?:debt|risk|default|rating|downgrade|borrowing)|government debt|budget deficit|credit rating|rating at aa|public finances|tpi|transmission protection instrument)\b')
_monetary_context = re.compile(r'\b' + BANKS + r'\b|\b(?:interest rates?|monetary|rate markets?|rate[ -](?:hikes?|cuts?|path)|inflation|yields?|borrowing costs?)\b')
_macro = re.compile(r'\b(?:inflation|cpi|pce|ppi|payrolls|unemployment|labour|labor|jobs data|employment|immigration|work visas?|foreign workers|gdp|economic growth|economy|macro resilience|business confidence|recession|stagflation|disinflation|industrial production|factory output|retail sales|home sales|mortgage rates|pmi|ism|monetary policy|mandate|central bank communications|power market)\b')
_economy = re.compile(r'\b(?:us|u\.s\.|united states|uk|british|britain|euro[ -]?zone|euro area|europe|european|german\w*|france|french|italy|italian|spain|spanish|japan\w*|swiss|switzerland|canad\w*|australi\w*|new zealand|china|chinese)\b')
_future_statement = re.compile(r'\b(?:could|may|might|expected to|set to) (?:warn|signal|announce|say|urge|call|issue)\b')
# A current move "most since 2025" is not a report about an old event.
_historical = re.compile(r'\b(?:last|previous) (?:meeting|decision|month|year)|\btelegraphed\b|^(?:history of|looking back|remembering)\b|\b(?:intervened|defaulted|collapsed|raised rates|cut rates|hiked rates)\b.{0,45}\bin 20\d\d\b')
_publisher = re.compile(r'\s+-\s+(?:Reuters|Bloomberg(?:\.com)?|Investing\.com(?:\s+[\w ]+)?|Financial Times|FXStreet|WSJ|MarketWatch|Barron.?s|Seeking Alpha|(?:bne )?IntelliNews(?: Lambda)?|CNBC|Kitco)\s*$', re.I)
_static_pricing = re.compile(r'(?:' + BANKS + r' hike is (?:around )?\d+(?:\.\d+)?% priced|markets expect ' + BANKS + r' hike|markets implied .{0,80}chance of .{0,50}' + BANKS + r' hike)')
_bank = re.compile(r'\b' + BANKS + r'\b')
_tracked_bank = re.compile(r'\b' + BANKS.replace('central banks?|', '') + r'\b')
_fx = re.compile(r'\b(?:usd|eur|gbp|jpy|chf|cad|aud|nzd|dxy|dollar|greenback|euro|sterling|yen|franc|(?:us|canadian|australian|new zealand) dollar)\b')
_fx_subject = re.compile(r'^(?:usd|eur|gbp|jpy|chf|cad|aud|nzd|dxy|dollar|greenback|euro|sterling|yen|franc)\b')
_policy_tone = re.compile(r'\b(?:hikes|hiking cycle|higher rates|tighter (?:monetary )?policy|more restriction|above neutral|aggressive (?:action|response)|(?:inflation|price pressures?).{0,55}(?:grown harder|no clear path|too (?:high|hot)|way higher|broadens|urgency|overheat\w*)|no clear path.{0,35}inflation|no need.{0,35}dramatic|(?:smaller|small) increments|loose.{0,15}policy|not clearly sufficient|pause.{0,35}not.{0,15}stop|keeps?.{0,35}hike.{0,15}in play)\b')
_liquidity_policy = re.compile(r'\b(?:reserve requirements?|euro swaps|swap lines?|market interventions?|bond.market intervention)\b')
_liquidity_change = re.compile(r'\b(?:discuss\w*|boost\w*|rais\w*|chang\w*|expand\w*|accessible|propos\w*|temporary|targeted|principles|guidelines|high bar|prepare)\b')
_policy_risk = re.compile(r'\b(?:market risks?|subprime bubble|financial system|financial sector|volatility risks? for sovereign bonds|independen\w*|mandate)\b')
_sovereign = re.compile(r'\b(?:treasur\w*|jgb\w*|bunds?|gilts?|(?:us|u\.s\.|uk|japan\w*|german|eurozone) .{0,25}(?:bonds?|yields?))\b')
_bond_event = re.compile(r'\b(?:auction tails?|weak demand|demand (?:disappoints|weakens)|auction.{0,45}(?:disappoint\w*|weak|strong)|(?:delay\w*|postpone\w*).{0,70}(?:launch|bond|jgb)|(?:yields?|bonds?|treasuries|gilts?|bunds?).{0,45}(?:sink\w*|spike\w*|surge\w*|explode\w*|rally|historic|sharply|below \d)|curve (?:inverts?|steepens?|flattens?))\b')
_macro_impulse = re.compile(r'\b(?:inflation|wages?|wage growth|payrolls|unemployment|jobless|gdp|economy|inflation expectations)\b.{0,65}\b(?:surpris\w*|unexpected\w*|miss\w*|less than forecast|contracts?|shrinks?|jump\w*|soars?|highest|fastest|strongest|accelerat\w*|correct\w*|hotter|undershot|soft\w*|slower)\b|\b(?:highest|fastest|strongest) .{0,35}wage growth\b|\b(?:correct\w*|revis\w*) .{0,35}inflation\b|\breal pay falls\b')
_inflation_channel = re.compile(r'\b(?:energy|fuel|diesel|oil|gas|power)\b.{0,90}\b(?:inflation|price pressures|economy|economic growth|global growth|recession)\b|\binflation.{0,70}(?:energy shock|fuel|energy costs)\b')
_intervention_watch = re.compile(r'\b(?:yen|jpy|franc|chf)\b.{0,100}\bintervention (?:watch|warnings|risks?|fears)\b|\bintervention (?:watch|warnings|risks?|fears)\b.{0,100}\b(?:yen|jpy|franc|chf)\b')
_strategic = re.compile(r'\b(?:hormuz|qeshm|qatar|bahrain|kuwait|gulf|nuclear sites?|red sea|bab el[ -]mandeb)\b|\bblack sea\b.{0,65}\b(?:ships?|shipping|tankers?)\b|\b(?:ships?|shipping|tankers?)\b.{0,65}\bblack sea\b')
_hostilities = re.compile(r'\b(?:attacks?|strikes?|struck|mines?|escalat\w*|exchange fire|flare.up|return to .{0,12}war|ceasefire|shipping risks?|talks (?:fail|collapse))\b')
_conflict = re.compile(r'\b(?:iran|israel|hormuz|middle east|russia|ukraine|taiwan|red sea|bab el[ -]mandeb)\b')
_restraint = re.compile(r'\b(?:highly |very |further |renewed )*unlikely\b.{0,65}\b(?:attacks?|strikes?|war)\b|\b(?:attacks?|strikes?|war)\b.{0,60}\b(?:unlikely|ruled out|off the table)\b|\b(?:hold(?:ing)? off|halt\w*|stop\w*|suspend\w*|resum\w*|rules? out)\b.{0,45}\b(?:strikes?|attacks?|fighting|bombing|military action)\b|\b(?:restraint|de[ -]?escalat\w*|ceasefire|peace (?:deal|agreement)|truce|takeover|reopen\w*)\b')
_risk_eases = re.compile(r'\b(?:worries|fears|concerns|tensions|uncertainty)\b.{0,30}\b(?:ease\w*|fad\w*|reced\w*|abate\w*)\b|\b(?:eas\w*|fad\w*|reced\w*)\b.{0,30}\b(?:worries|fears|concerns|tensions)\b|\b(?:market )?sentiment (?:improves?|brightens?|recovers?)\b')
_shipping_flow = re.compile(r'\b(?:oil|fuel|lng|gas|tanker|shipping|vessel)\b.{0,55}\b(?:flows?|traffic|loadings?|exports?|shipments?)\b|\b(?:flows?|traffic|loadings?|exports?)\b.{0,55}\b(?:oil|fuel|lng|gas)\b')
_major_equity = re.compile(r'\b(?:taiwan|nikkei|topix|nasdaq|s&p|dow|dax|ftse|stoxx|hang seng|kospi)\b')
_market_controls = re.compile(r'\b(?:short[ -](?:selling|sales?) (?:curbs|ban|restrictions)|bans? short sales|trading halts?|circuit breakers?)\b')
_reference_comparison = re.compile(r'\bat (?P<actual>\d+(?:\.\d+)?)\s*\(?vs\.?\s*(?:estimate|forecast)(?: at)?\s*(?P<forecast>\d+(?:\.\d+)?)')


def fixing_surprise(title):
    """A material actual/estimate gap, not the routine change from yesterday."""
    text = normalized(title)
    comparison = _reference_comparison.search(text)
    if not re.search(r'\bpboc\b', text) or not comparison:
        return False
    expected = float(comparison['forecast'])
    return expected > 0 and abs(float(comparison['actual']) / expected - 1) >= .0025


def cross_market_signal(title, summary=''):
    """Narrow exceptions for market-wide controls and strategic shipping shocks."""
    text = normalized(title + '\n' + summary)
    return bool(_major_equity.search(text) and _market_controls.search(text)
                or _strategic.search(text) and (_hostilities.search(text) or _restraint.search(text) or _shipping_flow.search(text)))


@lru_cache(maxsize=8192)
def market_signal(title, summary=''):
    """Return (explanation, Priority-1 candidate) from supplied text only."""
    text = normalized(_publisher.sub('', title) + '\n' + _publisher.sub('', summary))
    text = re.sub(r'\bfed up\b', 'frustrated', text)
    text = re.sub(r'\bfuel economy\b', 'vehicle efficiency', text)
    macro_text = re.sub(r'\bnot unexpectedly\b|\b(?:no|few|little|without) surprises?\b', '', text)
    routine_release = re.search(r'\b(?:no|few|little|without) surprises?\b|\bas expected\b', text)
    target, wide = bool(_target.search(text)), bool(_wide.search(text))
    headline = normalized(title)
    geo_scope = bool(_conflict.search(headline) and (_hostilities.search(headline) or _restraint.search(headline))
                     or (_fx.search(headline) or _commodity.search(headline)) and _conflict.search(text)
                     or re.search(r'\b(?:trump|white house|iran|israel|russia|ukraine)\b.{0,35}\b(?:says?|announces?|confirms?)\b.{0,60}\b(?:ceasefire|truce|hold off|strikes? unlikely|end\w* .{0,20}blockade)\b', normalized(summary)))
    reason = ''
    if geo_scope and _conflict.search(text) and _restraint.search(text) and not (re.search(r'\b(?:seeks?|hopes?|could .{0,25}agree)\b', headline) or '?' in title):
        reason = 'Geopolitical escalation, restraint or de-escalation'
    elif _conflict.search(text) and (_fx.search(text) or _commodity.search(text)) and re.search(r'\b(?:diplomacy|talks|peace hopes|deal optimism)\b', text) and re.search(r'\b(?:weaken\w*|strengthen\w*|pressur\w*|plung\w*|rall\w*|fell|fall\w*|slump\w*|lift\w*)\b', text):
        reason = 'Geopolitical escalation, restraint or de-escalation'
    elif (_fx.search(text) or _sovereign.search(text)) and _risk_eases.search(text):
        reason = 'Changing risk appetite or safe-haven demand'
    elif _risk.search(text):
        reason = 'Risk sentiment, safe-haven or carry-trade context'
    elif _rotation.search(text) and (target or wide):
        reason = 'Cross-asset capital rotation or flows'
    elif _stress.search(text):
        reason = 'Credit, liquidity or financial-stability risk'
    elif re.search(r'\b(?:banks|megabanks|lenders)\b', text) and _strain.search(text) and re.search(r'\b(?:data.cent(?:re|er)|ai|property|real estate)\b', text):
        reason = 'Bank exposure to sector financing risk'
    elif _credit.search(text) and _strain.search(text) and wide:
        reason = 'Changing credit or financing conditions'
    elif _intervention_watch.search(text) or _fx.search(text) and re.search(r'\b(?:record intervention|intervention gains|intervention.{0,45}(?:revers\w*|unwind\w*|erased))\b', text):
        reason = 'FX intervention risk or official currency warnings'
    elif fixing_surprise(title) or re.search(r'\bpboc\b', text) and re.search(r'\b(?:yuan|fix|fixing)\b', text) and re.search(r'\b(?:strongest|weakest|curb sharp moves|anchors|defend)\b', text):
        reason = 'Managed-currency policy or fixing surprise'
    elif (target or _economy.search(text)) and (_policy.search(text) and _monetary_context.search(text) or _rates.search(text) and _change.search(text)):
        reason = 'Monetary policy or rate-path repricing'
    elif _bank.search(text) and (_policy_tone.search(text) or _liquidity_policy.search(text) and _liquidity_change.search(text) or _policy_risk.search(text)):
        reason = 'Central-bank guidance, liquidity or policy risk'
    elif _sovereign.search(text) and _bond_event.search(text):
        reason = 'Sovereign yields, auction demand or funding conditions'
    elif (_tracked_bank.search(text) or _fx_subject.search(headline) or _economy.search(text)) and (not routine_release and _macro_impulse.search(macro_text) or _inflation_channel.search(text)
            or re.search(r'\binflation expectations\b.{0,55}\b(?:rise|fall|jump|drop|climb)\b', text)):
        reason = 'Growth, labour or inflation repricing context'
    elif (target or wide) and _position.search(text):
        reason = 'Positioning, crowding or short-covering risk'
    elif _commodity.search(text) and _supply.search(text):
        reason = 'Commodity supply, demand or inventory context'
    elif _strategic.search(text) and _shipping_flow.search(text) and re.search(r'\b(?:rises?|rising|recover\w*|return\w*|highest|lowest|pick\w* up|surge\w*|fall\w*|halt\w*|reopen\w*)\b', text):
        reason = 'Strategic energy shipping or supply recovery'
    elif wide and _broad_move.search(text):
        reason = 'Broad-market stress or changing risk conditions'
    elif _trade.search(text) and (_state.search(text) or _commodity.search(text)):
        reason = 'Trade policy or cross-border restrictions'
    elif re.search(r'\b(?:commerce|us)\b.{0,55}\bapprov\w*\b.{0,65}\b(?:ai chips|chip shipments|nvidia|amd)\b', text) and re.search(r'\bchina\b', text):
        reason = 'Trade policy or cross-border restrictions'
    elif _state.search(text) and re.search(r'\b(?:restart|resume|unlock)\b.{0,60}\b(?:private equity|investments|funding)\b', text):
        reason = 'Cross-asset capital rotation or flows'
    elif (_fiscal.search(text) and (target or _economy.search(text))
          and not (re.search(r'\b(?:credit )?rating (?:firm|agency|business)\b', text)
                   and re.search(r'\b(?:expands?|team|hires?|office)\b', text)
                   and not re.search(r'\b(?:downgrad\w*|default\w*|fiscal risks?)\b', text))):
        reason = 'Sovereign or fiscal risk context'
    elif _strategic.search(text) and _hostilities.search(text):
        reason = 'Strategic shipping or regional escalation risk'
    elif _major_equity.search(text) and _market_controls.search(text):
        reason = 'Market-wide trading or short-selling restrictions'
    if reason:
        # A future speech is still useful context, but has not happened yet.
        context_only = (not summary and _static_pricing.fullmatch(normalized(title)))
        if reason == 'Monetary policy or rate-path repricing' and _sovereign.search(text) and not _bank.search(text) and not _macro.search(text):
            context_only = context_only or re.search(r'\b(?:technical signals|bullish breakout|bearish breakout)\b|\byield expected to.{0,45}\bby end[ -]20\d\d\b', text)
        return reason, not bool(context_only or _future_statement.search(normalized(title)) or _historical.search(normalized(title)))
    if _fx.search(text) and re.search(r'\b(?:hawkish|dovish|agreements?|eu deals)\b', text):
        return 'Currency policy or cross-border context', False
    if _conflict.search(headline) and re.search(r'\b(?:noose|military|blockade|encircl\w*)\b', headline):
        return 'Geopolitical or strategic-market risk context', False
    if (target or _economy.search(text)) and _macro.search(text):
        return 'Target-market economic or policy context', False
    if wide and re.search(r'\b(?:yields|valuations|asset allocation)\b', text):
        return 'Cross-asset valuation context', False
    return '', False
