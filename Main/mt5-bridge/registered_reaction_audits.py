"""Frozen six-H4 reaction audits for the registered-reaction v4 registry.

Each tuple is calculated only from cases at or after the immutable experiment's
chronological split. Fields are:
  evaluable N, direction worked + trade profited, direction worked + trade did
  not profit, direction failed + trade profited, direction failed + trade did
  not profit, positive six-H4 response rate, median six-H4 response in R.

These diagnostics do not choose or qualify a setup. They preserve the important
distinction between an economic direction and the execution contract used to
trade it.
"""

from typing import Any, Dict, Optional, Tuple


REACTION_AUDIT_V1: Dict[Tuple[str, str], Tuple[int, int, int, int, int, float, float]] = {
  ("AUDUSD", "audusd-business-confidence-rejection"): (31, 17, 1, 8, 5, .580645, .262005),
  ("AUDUSD", "audusd-ism-manufacturing-employment-package"): (44, 12, 9, 0, 23, .477273, -.226502),
  ("AUDUSD", "audusd-s-p-global-manufacturing-pmi"): (36, 17, 1, 5, 13, .5, .050691),
  ("AUDUSD", "audusd-us-payroll-package"): (31, 13, 1, 5, 12, .451613, -.045827),
  ("AUDUSD", "audusd-us-producer-inflation"): (32, 15, 5, 2, 10, .625, .209368),
  ("EURUSD", "eurusd-business-climate-indicator-package"): (27, 9, 0, 6, 12, .333333, -.24259),
  ("EURUSD", "eurusd-consumer-sentiment-restored"): (25, 11, 3, 1, 10, .56, .380527),
  ("EURUSD", "eurusd-cpi-package"): (73, 20, 15, 9, 29, .479452, -.042334),
  ("EURUSD", "eurusd-ism-manufacturing-employment-package"): (42, 24, 0, 0, 18, .571429, .118124),
  ("EURUSD", "eurusd-retail-sales-m-m-package"): (28, 8, 4, 4, 12, .428571, -.086137),
  ("EURUSD", "eurusd-s-p-global-composite-pmi-package"): (25, 13, 0, 5, 7, .52, .054121),
  ("EURUSD", "eurusd-us-payroll-short-restored"): (14, 8, 0, 0, 6, .571429, .268141),
  ("EURUSD", "eurusd-us-producer-inflation-cooling-restored"): (11, 6, 1, 1, 3, .636364, .261048),
  ("EURUSD", "us-industrial-output-directional"): (31, 17, 1, 7, 6, .580645, .217257),
  ("GBPUSD", "gbpusd-average-weekly-earnings-regular-pay-y-y-package"): (16, 8, 0, 3, 5, .5, .040965),
  ("GBPUSD", "gbpusd-gdp-sales-q-q-package"): (17, 7, 1, 2, 7, .470588, -.034481),
  ("GBPUSD", "gbpusd-ism-non-manufacturing-business-activity-package"): (30, 16, 0, 1, 13, .533333, .056616),
  ("GBPUSD", "gbpusd-us-industrial-output"): (32, 17, 3, 7, 5, .625, .38518),
  ("GBPUSD", "gbpusd-us-labor-claims"): (131, 35, 27, 11, 58, .473282, -.079269),
  ("NZDUSD", "nzdusd-gdp-annual-change-package"): (21, 9, 4, 0, 8, .619048, .640696),
  ("NZDUSD", "nzdusd-gdp-sales-q-q-package"): (16, 6, 1, 4, 5, .4375, -.200793),
  ("NZDUSD", "nzdusd-us-payroll-package"): (27, 11, 2, 6, 8, .481481, -.032734),
  ("NZDUSD", "nzdusd-us-producer-inflation"): (32, 13, 5, 3, 11, .5625, .239872),
  ("NZDUSD", "nzdusd-us-trade-balance"): (62, 17, 17, 3, 25, .548387, .069262),
  ("USDCAD", "usdcad-canada-retail-sales"): (30, 8, 5, 1, 16, .433333, -.124474),
  ("USDCAD", "usdcad-gdp-annualized-q-q-package"): (26, 13, 1, 6, 6, .538462, .085526),
  ("USDCAD", "usdcad-gdp-sales-q-q-package"): (11, 3, 3, 1, 4, .545455, .203472),
  ("USDCAD", "usdcad-ism-manufacturing-employment-package"): (44, 17, 6, 0, 21, .522727, .032004),
  ("USDCAD", "usdcad-s-p-global-composite-pmi-package"): (27, 15, 0, 5, 7, .555556, .037948),
  ("USDCAD", "usdcad-us-consumer-inflation"): (80, 18, 25, 5, 32, .5375, .191242),
  ("USDCAD", "usdcad-us-producer-inflation"): (30, 16, 1, 3, 10, .566667, .12222),
  ("USDCHF", "usdchf-fed-industrial-production-m-m-package"): (29, 16, 0, 0, 13, .551724, .040376),
  ("USDCHF", "usdchf-ppi-m-m-package"): (26, 13, 1, 5, 7, .538462, .093566),
  ("USDCHF", "usdchf-us-employment-release"): (37, 19, 0, 5, 13, .513514, .01838),
  ("USDJPY", "usdjpy-adjusted-current-account-package"): (21, 11, 0, 4, 6, .52381, .608853),
  ("USDJPY", "usdjpy-consumer-confidence-index"): (24, 12, 3, 2, 7, .625, .444827),
  ("USDJPY", "usdjpy-fed-industrial-production-m-m-package"): (34, 13, 0, 10, 11, .382353, -.290097),
  ("USDJPY", "usdjpy-industrial-production-forecast-1-month-ahead-m-m-package"): (21, 13, 2, 2, 4, .714286, .328366),
  ("USDJPY", "usdjpy-ism-non-manufacturing-business-activity-package"): (30, 6, 10, 4, 10, .533333, .027058),
  ("USDJPY", "usdjpy-jpy-inflation"): (65, 30, 7, 6, 22, .569231, .133203),
  ("USDJPY", "usdjpy-jpy-labor-wages"): (25, 10, 5, 1, 9, .6, .275869),
  ("USDJPY", "usdjpy-us-consumer-sentiment"): (111, 45, 10, 17, 39, .495495, -.019891),
  ("USDJPY", "usdjpy-us-employment-release"): (36, 14, 1, 0, 21, .416667, -.046679),
  ("USDJPY", "usdjpy-us-manufacturing-employment"): (58, 33, 0, 9, 16, .568966, .226151),
  ("USDJPY", "usdjpy-us-payroll-package"): (26, 12, 0, 7, 7, .461538, -.030773),
  ("USDJPY", "usdjpy-us-producer-inflation-rejection"): (32, 12, 4, 0, 16, .5, .008608),
  ("USDJPY", "usdjpy-us-trade-balance-ordinary"): (38, 24, 3, 5, 6, .710526, .294805),
}


def registered_reaction_audit(market: str, pattern_id: str) -> Optional[Dict[str, Any]]:
  row = REACTION_AUDIT_V1.get((market, pattern_id))
  if row is None:
    return None
  n, worked_profit, worked_loss, failed_profit, failed_loss, positive_rate, median_r = row
  return {
    "schema": "registered-reaction-audit-v1",
    "scope": "chronological later-test cases",
    "horizonCandles": 6,
    "evaluableN": n,
    "directionWorkedTradeProfited": worked_profit,
    "directionWorkedTradeLost": worked_loss,
    "directionFailedTradeProfited": failed_profit,
    "directionFailedTradeLost": failed_loss,
    "positiveResponseRate": positive_rate,
    "medianResponseR": median_r,
  }
