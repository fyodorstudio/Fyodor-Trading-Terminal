# Learning currency strength with the analyst

Anchor your observation to: **Could this information change the expected future
interest-rate path, and does that change favour this currency over the other one?**
An actual rate, a forecast beat and a higher number are each pieces of evidence.
They don't have a permanent buy/sell direction. Start with one pair and learn its
backdrop. You can hand the research to the agent with a short question and a report.

## Learning order and Alert shortlist

| Order | Families to watch | Question for the analyst |
|---|---|---|
| 1 | Central-bank decision, statement, projections and press conference | What changed in the expected future path, even if today's rate was held? |
| 2 | Headline and underlying inflation | Does inflation look persistent enough to alter policy, relative to expectations? |
| 3 | Employment, unemployment and wages | Does the labour market support tighter policy, or make easing more likely? |
| 4 | Retail sales, business surveys and GDP | Is demand changing enough to reinforce or challenge the policy outlook? |

Use the first three as your initial Alert watchlist for the currencies you follow.
Add demand releases once the inflation/labour story feels familiar. Filter what
you see; research exports still preserve all stored releases for the chosen scope.
An alert is a candidate for investigation, not a requirement to trade.

## The same approach across all eight currencies

Read the decision and guidance of each currency's central bank first. The table
is a learning shortlist, not a permanent ranking of market impact. Which family
matters most changes with the bank's concerns and the prevailing backdrop.

| Currency / bank | Inflation anchor | Labour anchor | Demand and additional context |
|---|---|---|---|
| USD / Federal Reserve | CPI/core CPI, PCE/core PCE; monthly persistence as well as annual rates | Payrolls, unemployment, earnings, participation and revisions | Retail sales and its underlying components, ISM surveys, GDP; Treasury yields and priced Fed path |
| EUR / ECB | Euro-area flash HICP and core/services inflation; national releases as clues to the aggregate | Euro-area employment/unemployment and wage measures, including negotiated wages | Euro-area PMIs, GDP and retail sales; energy costs and sovereign-bond stress when relevant |
| GBP / Bank of England | CPI/core CPI and services inflation | Employment, unemployment and private-sector regular pay; check estimate quality/revisions | Retail sales, PMIs and GDP; compare the BoE and Fed paths for GBPUSD |
| JPY / Bank of Japan | Tokyo/national CPI and underlying inflation; Japanese “core” definitions differ from US core | Wages, annual wage negotiations and labour conditions | Tankan, GDP and consumption; foreign-versus-Japanese yields, risk flows and verified Ministry of Finance intervention |
| CHF / Swiss National Bank | Swiss CPI and the SNB's conditional inflation forecast | Employment/unemployment as supporting evidence | GDP, surveys and exchange-rate/import-price pressures; verify intervention communication and risk-related flows |
| CAD / Bank of Canada | CPI, especially CPI-trim/CPI-median and broader underlying inflation | Employment, unemployment, hours and wages | Retail sales, monthly GDP and trade; oil/global demand can affect the currency beyond local rates |
| AUD / Reserve Bank of Australia | CPI and trimmed-mean underlying inflation | Employment, unemployment, participation, hours and wage measures | Retail/household spending, GDP and business surveys; Chinese demand, commodities and global risk appetite |
| NZD / Reserve Bank of New Zealand | CPI, non-tradables/services inflation and the RBNZ's projected OCR path | Employment, unemployment and labour-cost/wage measures | Retail sales, GDP and business confidence; dairy/export conditions and global risk appetite |

These anchors reflect the banks' own discussions of inflation, wages and economic
conditions: [Fed](https://www.federalreserve.gov/aboutthefed/fedexplained/monetary-policy.htm),
[ECB](https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.mp260910~314e508016.en.html),
[BoE](https://www.bankofengland.co.uk/speech/2026/september/clare-lombardelli-speech-at-the-sixth-biennial-conference-poland),
[BoJ](https://www.boj.or.jp/en/mopo/outlook/gor2607b.pdf),
[SNB](https://www.snb.ch/en/the-snb/mandates-goals/monetary-policy/strategy),
[BoC](https://www.bankofcanada.ca/core-functions/monetary-policy/),
[RBA](https://www.rba.gov.au/publications/smp/2026/may/overview.html), and
[RBNZ](https://www.rbnz.govt.nz/monetary-policy/about-monetary-policy/monetary-policy-handbook).
The suggested trading shortlist is our workflow choice; verify current release
definitions, schedules and bank priorities during each briefing.

## Read packages, rather than isolated numbers

**Inflation:** Ask whether the surprise was in underlying prices or mainly energy,
what the monthly trend shows, and whether it changes policy expectations. A lower
annual rate can coexist with a stronger monthly reading.

**Labour:** Strong payrolls with downward revisions, rising unemployment or softer
wages can give a mixed message. “More jobs” is not automatically a lasting currency
buy. Revisions and survey quality matter; don't combine unlike surveys as if they
measure exactly the same thing.

**Retail sales:** Check revisions, headline versus underlying components, and
whether values are nominal or volumes. Higher prices can lift nominal sales
without stronger real demand. Ask whether consumption changes the policy story.

**Rates:** A hold can strengthen a currency if guidance raises expected future
rates; it can weaken it if traders expected an immediate hike or stronger guidance.
An expected hike may deliver little new information. Separate the announcement
from the press-conference reaction.

The SNB's conditional inflation forecast assumes an unchanged policy rate; it is
not a forecast of the SNB's future rate path. NZ employment still informs demand
and inflation analysis, but the RBNZ removed maximum sustainable employment as a
primary objective in 2023. [SNB strategy](https://www.snb.ch/en/the-snb/mandates-goals/monetary-policy/strategy),
[RBNZ handbook](https://www.rbnz.govt.nz/monetary-policy/about-monetary-policy/monetary-policy-handbook)

## A briefing you can use

Before a release, ask for the backdrop, identified expectations and conditional
outcomes. Afterward, ask what changed and whether the first move lasted. A useful
result sounds like: “Core inflation was firmer than expected, supporting a hike,
but the initial dollar buying reversed.” The policy message and the observed FX
reaction can differ without either being imaginary.

Observe the first minute, then 5/15/30/60 minutes, and the wider session as relevant.
Use complete M1 evidence for event reactions; H1 candles can hide reversals inside
an hour. A multiweek chart needs a sequence of changing drivers, not a sum of all
the releases in the range. Ask the agent to distinguish the two currency stories
and tell you what would invalidate its view. No clear edge is a useful outcome.

Pair direction matters: GBP strength tends to support GBPUSD, while CAD strength
tends to weigh on USDCAD, other factors equal. JPY/CHF can require more attention
to intervention, risk flows and overseas rates than a simple domestic-data story.
Add one currency at a time instead of recreating the eight-currency research burden.

## Forecast providers and the handoff

Your broker's forecast and a Reuters/Bloomberg/other survey can differ because of
provider, sample, methodology, definition or capture time. Keep both attributed;
don't assume either discrepancy is a bug. The agent verifies the actual release
with official sources, then researches identified expectations and policy pricing
on the web. A numerical A−F in the terminal is not a currency-strength score.

Use **Research date range**, name the report and write your observations while
panning or inspecting releases. **Prepare research** saves a Markdown brief and
complete TSV evidence in `Market Analyst Workflow/report/`. Alert's **Research**
prepares the same handoff for an upcoming release. Copy the brief path, then ask:

> Read market-analyst-agent.md and my latest report. Explain the currency backdrop,
> the important changes and the practical scenarios in plain language.

You can also give just a date and release name; the agent can query local calendar
and OHLC itself using [dataset navigation](dataset-navigation.md). Web research
supplies the expectations, guidance and off-calendar developments absent from the
stored release fields. The agent presents the briefing in chat unless you request
a saved analysis. Existing notes and evidence remain separate from conclusions.
