from __future__ import annotations

from datetime import datetime, timezone

from macro_signal import (
  aggregate_outcomes,
  build_backtest_result,
  build_chart_signal_pattern_catalog,
  build_chart_signal_realtime_watch,
  build_policy_inflation_context,
  build_signal_candidates,
  calculate_atr_by_candle,
  candidate_pattern_signature,
  discover_qualified_chart_patterns,
  evaluate_candidate,
  get_signal_definition,
  score_event,
  V2_VERSION_ID,
  SENTIMENT_VERSION_ID,
  POLICY_INFLATION_VERSION_ID,
  GROWTH_VERSION_ID,
  CHART_SIGNAL_MODEL_ID,
  CHART_SIGNAL_PATTERN_DEFINITIONS,
)


def calendar_event(
  event_id: int,
  timestamp: int,
  currency: str,
  title: str,
  actual: str,
  forecast: str,
  previous: str,
  impact: str = "high",
) -> dict:
  return {
    "id": event_id,
    "time": timestamp,
    "countryCode": "EU" if currency == "EUR" else "US",
    "currency": currency,
    "title": title,
    "impact": impact,
    "actual": actual,
    "forecast": forecast,
    "previous": previous,
  }


def candles(count: int = 60, start: int = 0, step: int = 14_400) -> list[dict]:
  rows = []
  close = 1.1000
  for index in range(count):
    open_price = close
    close = open_price + 0.0001
    rows.append({
      "time": start + index * step,
      "open": open_price,
      "high": open_price + 0.0010,
      "low": open_price - 0.0010,
      "close": close,
      "volume": 10,
    })
  return rows


def candidate(direction: str = "long", event_time: int = 14_400 * 20 + 1) -> dict:
  return {
    "eventTime": event_time,
    "direction": direction,
    "agreement": "consensus",
    "pairVote": 1 if direction == "long" else -1,
    "backgroundDirection": "none",
    "backgroundPairVote": 0,
    "backgroundAlignment": "neutral",
    "highestImpact": "high",
    "factorVotes": [],
    "events": [],
  }


def test_event_score_matches_existing_equal_surprise_momentum_formula() -> None:
  positive = score_event(calendar_event(1, 100, "EUR", "GDP q/q", "2.0", "1.5", "1.0"))
  conflict = score_event(calendar_event(2, 100, "EUR", "GDP q/q", "1.5", "1.0", "2.0"))
  unemployment = score_event(calendar_event(3, 100, "USD", "Unemployment Rate", "4.0", "4.2", "4.3"))

  assert positive and positive["score"] == 3
  assert conflict and conflict["score"] == 0
  assert unemployment and unemployment["score"] == 3


def test_release_packages_orient_eur_and_usd_and_retain_conflicted_majority() -> None:
  events = [
    calendar_event(1, 100, "EUR", "GDP q/q", "2.0", "1.5", "1.0"),
    calendar_event(2, 200, "USD", "GDP q/q", "2.0", "1.5", "1.0"),
    calendar_event(3, 300, "EUR", "GDP q/q", "2.0", "1.5", "1.0"),
    calendar_event(4, 300, "EUR", "Retail Sales m/m", "-1.0", "0.0", "0.0"),
    calendar_event(5, 300, "USD", "Consumer Confidence", "80", "90", "90"),
  ]

  packages = build_signal_candidates(events, now=400)

  assert [(row["eventTime"], row["direction"]) for row in packages[:2]] == [(100, "long"), (200, "short")]
  assert packages[2]["direction"] == "long"
  assert packages[2]["agreement"] == "conflicted_weak"


def test_background_alignment_is_measured_without_filtering_the_candidate() -> None:
  packages = build_signal_candidates([
    calendar_event(1, 100, "EUR", "GDP q/q", "2.0", "1.5", "1.0"),
    calendar_event(2, 200, "USD", "Retail Sales m/m", "2.0", "1.0", "1.0"),
  ], now=300)

  assert packages[1]["direction"] == "short"
  assert packages[1]["backgroundDirection"] == "long"
  assert packages[1]["backgroundAlignment"] == "conflicted"


def test_exact_vote_tie_is_retained_without_a_direction() -> None:
  package = build_signal_candidates([
    calendar_event(1, 100, "EUR", "GDP q/q", "2.0", "1.0", "1.0"),
    calendar_event(2, 100, "EUR", "Retail Sales m/m", "-1.0", "0.0", "0.0"),
  ], now=200)[0]

  assert package["direction"] == "none"
  assert package["agreement"] == "no_direction"
  assert package["pairVote"] == 0


def test_entry_is_strictly_after_release_and_uses_completed_atr() -> None:
  rows = candles()
  atr = calculate_atr_by_candle(rows)
  release_at_open = rows[20]["time"]
  result = evaluate_candidate(
    candidate(event_time=release_at_open),
    rows,
    [row["time"] for row in rows],
    atr,
    2.0,
  )

  assert result["entryTime"] == rows[21]["time"]
  assert result["atr"] == atr[20]


def test_live_paper_outcome_remains_pending_until_the_full_window_completes() -> None:
  rows = candles(count=30)
  atr = calculate_atr_by_candle(rows)
  result = evaluate_candidate(
    candidate(event_time=rows[20]["time"]),
    rows,
    [row["time"] for row in rows],
    atr,
    2.0,
    allow_pending=True,
    as_of=rows[-1]["time"] + 60,
  )

  assert result["status"] == "pending"
  assert result["entryTime"] == rows[21]["time"]
  assert aggregate_outcomes([result])["pendingCount"] == 1


def test_chart_pattern_requires_repeatable_positive_development_and_holdout_results() -> None:
  def outcome(event_time: int, target_hit: bool) -> dict:
    return {
      **candidate(direction="short", event_time=event_time),
      "targetR": 2.0,
      "events": [{"currency": "USD", "scoreGroup": "employment", "title": "ADP Nonfarm Employment Change"}],
      "status": "target_hit" if target_hit else "stop_hit",
      "resultR": 2.0 if target_hit else -1.0,
    }

  development = [outcome(index, index < 12) for index in range(30)]
  holdout = [outcome(100 + index, index < 4) for index in range(10)]
  patterns = discover_qualified_chart_patterns([*development, *holdout], split_time=100)

  assert candidate_pattern_signature(development[0]) == "short|USD:employment"
  assert len(patterns) == 1
  assert patterns[0]["direction"] == "short"
  assert patterns[0]["development"]["averageR"] == 0.2
  assert patterns[0]["holdout"]["averageR"] == 0.2


def test_v3_current_pattern_survives_execution_recent_and_year_stability_gates() -> None:
  outcomes = []
  for year in range(2016, 2027):
    for index in range(5):
      target_hit = index < 3
      event_time = int(datetime(year, 1, index + 1, tzinfo=timezone.utc).timestamp())
      outcomes.append({
        **candidate(direction="short", event_time=event_time),
        "targetR": 2.0,
        "events": [
          {"currency": "USD", "scoreGroup": "employment", "title": "Nonfarm Payrolls"},
          {"currency": "USD", "scoreGroup": "labor_wages", "title": "Average Hourly Earnings"},
          {"currency": "USD", "scoreGroup": "unemployment", "title": "Unemployment Rate"},
        ],
        "status": "target_hit" if target_hit else "stop_hit",
        "resultR": 2.0 if target_hit else -1.0,
        "atr": 0.01,
        "entryTime": event_time + 14_400,
      })

  split_time = int(datetime(2024, 1, 1, tzinfo=timezone.utc).timestamp())
  catalog = build_chart_signal_pattern_catalog(
    outcomes,
    split_time,
    {str(target): [{**row, "targetR": target} for row in outcomes] for target in (1.0, 1.5, 2.0)},
  )

  assert len(catalog) == 1
  assert catalog[0]["label"] == "US payroll package"
  assert catalog[0]["currentEligible"] is True
  assert catalog[0]["executionStress"]["recent"]["evaluableCount"] >= 10
  assert catalog[0]["executionStress"]["recent"]["averageR"] > 0
  assert catalog[0]["yearStability"]["positiveYearShare"] >= 0.60
  assert [row["targetR"] for row in catalog[0]["targetRobustness"]] == [1.0, 1.5, 2.0]
  assert catalog[0]["estimatedBreakEvenStressPips"] > 0
  assert isinstance(catalog[0]["uncertaintyIncludesNoEdge"], bool)


def test_directional_sentiment_is_one_pattern_and_future_watch_never_predicts_direction() -> None:
  outcomes = []
  for index in range(20):
    direction = "long" if index % 2 == 0 else "short"
    outcomes.append({
      **candidate(direction=direction, event_time=1_000 + index),
      "targetR": 2.0,
      "events": [{"currency": "EUR", "scoreGroup": "consumer_sentiment", "title": "Consumer Confidence Index"}],
      "status": "target_hit" if index % 3 != 0 else "stop_hit",
      "resultR": 2.0 if index % 3 != 0 else -1.0,
      "atr": 0.01,
      "entryTime": 15_400 + index,
    })
  catalog = build_chart_signal_pattern_catalog(
    outcomes,
    1_015,
    {"2.0": outcomes},
    SENTIMENT_VERSION_ID,
  )

  assert len(catalog) == 1
  assert catalog[0]["id"] == "euro-consumer-sentiment-directional"
  assert catalog[0]["direction"] == "both"
  assert catalog[0]["overall"]["evaluableCount"] == 20

  watch = build_chart_signal_realtime_watch([
    calendar_event(1, 110, "USD", "CB Leading Economic Index m/m", "", "1", "0"),
    calendar_event(2, 120, "EUR", "Consumer Confidence Index", "", "1", "0", "medium"),
    calendar_event(3, 105, "GBP", "Consumer Confidence Index", "", "1", "0"),
  ], as_of=100)
  assert watch["nextPairEvent"]["title"] == "CB Leading Economic Index m/m"
  assert watch["nextPatternWatch"]["patternId"] == "euro-consumer-sentiment-directional"
  assert "direction" not in watch["nextPatternWatch"]
  filtered_watch = build_chart_signal_realtime_watch(
    [calendar_event(2, 120, "EUR", "Consumer Confidence Index", "", "1", "0", "medium")],
    as_of=100,
    eligible_pattern_ids=frozenset({"us-industrial-output-short"}),
  )
  assert filtered_watch["nextPatternWatch"] is None


def test_v5_deduplicates_exact_inflation_series_and_keeps_policy_context_descriptive() -> None:
  definition = get_signal_definition(POLICY_INFLATION_VERSION_ID)
  assert definition is not None
  rows = [
    calendar_event(1, 100, "USD", "Core CPI y/y", "3.2", "3.0", "2.9"),
    calendar_event(2, 100, "USD", "Core CPI y/y", "3.2", "3.0", "2.9"),
    calendar_event(3, 110, "USD", "Fed Interest Rate Decision", "3.75", "", "3.75"),
    calendar_event(4, 110, "USD", "FOMC Statement", "", "", ""),
    calendar_event(5, 120, "EUR", "PPI y/y", "2.0", "1.0", "0.5"),
  ]
  candidates = build_signal_candidates(rows, now=200, definition=definition)

  inflation = next(row for row in candidates if row["eventTime"] == 100)
  assert inflation["direction"] == "short"
  assert len(inflation["events"]) == 1
  policy = next(row for row in candidates if row["eventTime"] == 110)
  assert policy["direction"] == "none"
  assert [event["title"] for event in policy["events"]] == ["Fed Interest Rate Decision"]

  context = build_policy_inflation_context(rows, as_of=200)
  assert context["currencies"]["USD"]["policy"]["state"] == "holding"
  assert context["currencies"]["USD"]["inflation"]["state"] == "heating"
  assert context["currencies"]["EUR"]["inflation"]["state"] == "heating"
  assert "do not filter or reverse" in context["usage"]


def test_v7_growth_rules_are_country_aware_narrow_and_deduplicated() -> None:
  definition = get_signal_definition(GROWTH_VERSION_ID)
  assert definition is not None
  rows = [
    calendar_event(1, 100, "EUR", "GDP q/q", "0.5", "0.2", "0.1"),
    calendar_event(2, 100, "EUR", "GDP q/q", "0.5", "0.2", "0.1"),
    calendar_event(3, 110, "USD", "GDP Price Index q/q", "3.0", "2.0", "1.0"),
    calendar_event(4, 120, "USD", "Kansas City Fed Manufacturing Composite", "10", "5", "0"),
    calendar_event(5, 130, "USD", "Industrial Production m/m", "0.4", "0.2", "0.1"),
    calendar_event(6, 140, "USD", "Retail Sales m/m", "0.5", "0.2", "0.1"),
    calendar_event(7, 150, "EUR", "Trade Balance", "20", "15", "10"),
    {**calendar_event(8, 160, "EUR", "GDP y/y", "1.0", "0.5", "0.2"), "countryCode": "DE"},
  ]

  candidates = build_signal_candidates(rows, now=200, definition=definition)

  assert [row["eventTime"] for row in candidates] == [100, 130, 140, 150]
  assert len(candidates[0]["events"]) == 1
  assert [row["events"][0]["ruleId"] for row in candidates] == [
    "growth_gdp",
    "growth_industrial_output",
    "growth_headline_retail",
    "growth_trade_balance",
  ]
  pattern = next(row for row in CHART_SIGNAL_PATTERN_DEFINITIONS if row["id"] == "us-industrial-output-short")
  assert CHART_SIGNAL_MODEL_ID == "FMS-EURUSD-MULTI-H4-CQ-v9"
  assert pattern["sourceVersion"] == GROWTH_VERSION_ID
  assert pattern["signatures"] == ("short|USD:industrial_output",)
  assert pattern["current"] is True


def test_same_m1_bar_touch_is_ambiguous() -> None:
  rows = candles()
  atr = calculate_atr_by_candle(rows)
  entry_index = 21
  entry = rows[entry_index]["open"]
  risk = atr[entry_index - 1]
  assert risk is not None
  rows[entry_index] = {
    **rows[entry_index],
    "low": entry - risk - 0.0001,
    "high": entry + 2 * risk + 0.0001,
  }
  minute = [{
    "time": rows[entry_index]["time"],
    "open": entry,
    "high": entry + 2 * risk + 0.0001,
    "low": entry - risk - 0.0001,
    "close": entry,
    "volume": 1,
  }]

  result = evaluate_candidate(
    candidate(),
    rows,
    [row["time"] for row in rows],
    atr,
    2.0,
    lambda _from, _to: minute,
  )

  assert result["status"] == "ambiguous"
  assert result["reason"] == "Both touched — order unknown"


def test_expired_result_is_marked_to_market_and_included_in_expectancy() -> None:
  rows = candles()
  atr = calculate_atr_by_candle(rows)
  result = evaluate_candidate(
    candidate(), rows, [row["time"] for row in rows], atr, 2.0
  )
  metrics = aggregate_outcomes([result])

  assert result["status"] == "expired"
  assert result["resultR"] is not None
  assert metrics["expiredCount"] == 1
  assert metrics["averageR"] == result["resultR"]


def test_backtest_reports_split_cohorts_data_quality_and_plain_conclusion() -> None:
  rows = candles(count=100)
  events = [
    calendar_event(1, rows[20]["time"] + 1, "EUR", "GDP q/q", "2.0", "1.5", "1.0"),
    calendar_event(2, rows[50]["time"] + 1, "USD", "GDP q/q", "2.0", "1.5", "1.0"),
    calendar_event(3, rows[55]["time"] + 1, "USD", "GDP q/q", "", "1.5", "1.0"),
  ]
  result = build_backtest_result(
    events,
    rows,
    None,
    {"count": 3, "earliest": events[0]["time"], "latest": events[-1]["time"], "currencies": []},
    rows[-1]["time"] + 1,
  )

  activity = result["cohorts"]["factor"][0]
  assert result["resultSchemaVersion"] == 3
  assert activity["key"] == "activity"
  assert activity["development"] is not None
  assert activity["holdout"] is not None
  assert result["dataQuality"]["registeredEconomyRows"] == 3
  assert result["dataQuality"]["missingActualRows"] == 1
  assert result["conclusion"]["code"] == "no_validated_edge"
  assert "must not be placed on Charts" in result["conclusion"]["summary"]


def test_v2_is_labor_only_country_aware_and_scoped_to_eu_us_aggregates() -> None:
  definition = get_signal_definition(V2_VERSION_ID)
  assert definition is not None
  events = [
    {**calendar_event(1, 100, "EUR", "Unemployment Rate", "4.0", "4.2", "4.3"), "countryCode": "EU"},
    {**calendar_event(2, 100, "EUR", "Unemployment Rate", "6.0", "5.8", "5.7"), "countryCode": "DE"},
    {**calendar_event(3, 100, "EUR", "GDP q/q", "2.0", "1.5", "1.0"), "countryCode": "EU"},
    {**calendar_event(4, 200, "EUR", "Unemployment Rate", "3.9", "4.0", "4.0"), "countryCode": "EU"},
  ]

  packages = build_signal_candidates(events, now=300, definition=definition)

  assert [event["factor"] for event in packages[0]["events"]] == ["labor"]
  assert packages[0]["events"][0]["countryCode"] == "EU"
  assert all(event["title"] != "GDP q/q" for package in packages for event in package["events"])
  assert packages[1]["backgroundDirection"] == "long"

  result = build_backtest_result(
    events,
    candles(count=80),
    None,
    {"count": len(events), "earliest": 100, "latest": 200, "currencies": []},
    definition.created_at + 1,
    definition,
  )
  assert result["status"] == "exploratory_reused_history"
  assert result["eligibility"]["historicalEligibilityDisabled"] is True
  assert result["forwardPaper"]["metrics"]["candidateCount"] == 0
  assert result["conclusion"]["code"] == "forward_observation_required"
