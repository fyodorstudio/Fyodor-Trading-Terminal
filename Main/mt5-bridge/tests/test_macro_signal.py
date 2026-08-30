from __future__ import annotations

from datetime import datetime, timezone

from macro_signal import (
  aggregate_outcomes,
  apply_chart_pattern_reaction,
  build_backtest_result,
  build_workbench_experiment,
  build_chart_signal_pattern_catalog,
  build_chart_signal_realtime_watch,
  build_candidate_path_profile,
  build_policy_inflation_context,
  build_signal_candidates,
  calculate_atr_by_candle,
  candidate_matches_chart_pattern,
  candidate_pattern_signature,
  discover_qualified_chart_patterns,
  evaluate_candidate,
  get_signal_definition,
  score_event,
  simulate_candidate_path,
  summarize_candidate_paths,
  compare_source_values_strict,
  _rescore_policy_outcomes,
  _annotate_numeric_robustness,
  _package_completeness,
  V2_VERSION_ID,
  SENTIMENT_VERSION_ID,
  POLICY_INFLATION_VERSION_ID,
  GROWTH_VERSION_ID,
  MARKET_RESEARCH_SPECS,
  MARKET_SOURCE_VERSION_IDS,
  CHART_SIGNAL_MODEL_ID,
  CHART_SIGNAL_PATTERN_DEFINITIONS,
)


def test_candidate_path_profile_reports_mfe_mae_and_threshold_reach() -> None:
  rows = [
    {"time": 100, "open": 1.1000, "high": 1.1020, "low": 1.0990, "close": 1.1010, "volume": 1},
    {"time": 200, "open": 1.1010, "high": 1.1040, "low": 1.1000, "close": 1.1030, "volume": 1},
  ]
  outcome = {"eventTime": 90, "entryTime": 100, "entry": 1.1000, "atr": 0.0020, "direction": "long"}
  profile = build_candidate_path_profile(outcome, rows, [100, 200], maximum_holding_candles=2)

  assert profile is not None
  summary = summarize_candidate_paths([profile], holding_candles=2)
  assert round(summary["mfeR"]["median"], 6) == 2.0
  assert round(summary["maeR"]["median"], 6) == 0.5
  assert next(row for row in summary["thresholdReach"] if row["thresholdR"] == 0.25)["rate"] == 1.0
  assert next(row for row in summary["thresholdReach"] if row["thresholdR"] == 2.0)["rate"] == 1.0


def test_flexible_path_simulation_respects_direction_expiry_and_same_bar_ambiguity() -> None:
  long_profile = {
    "entry": 1.1000, "atr": 0.0010, "direction": "long", "sign": 1.0,
    "candles": [{"time": 100, "open": 1.1000, "high": 1.1021, "low": 1.0995, "close": 1.1020}],
  }
  short_profile = {
    "entry": 1.1000, "atr": 0.0010, "direction": "short", "sign": -1.0,
    "candles": [{"time": 100, "open": 1.1000, "high": 1.1005, "low": 1.0979, "close": 1.0980}],
  }
  ambiguous_profile = {
    "entry": 1.1000, "atr": 0.0010, "direction": "long", "sign": 1.0,
    "candles": [{"time": 100, "open": 1.1000, "high": 1.1021, "low": 1.0989, "close": 1.1005}],
  }
  expired_profile = {
    "entry": 1.1000, "atr": 0.0010, "direction": "long", "sign": 1.0,
    "candles": [{"time": 100, "open": 1.1000, "high": 1.1006, "low": 1.0995, "close": 1.1005}],
  }

  assert simulate_candidate_path(long_profile, 1.0, 2.0, 1, stress_pips=0)["status"] == "target_hit"
  assert simulate_candidate_path(short_profile, 1.0, 2.0, 1, stress_pips=0)["status"] == "target_hit"
  assert simulate_candidate_path(ambiguous_profile, 1.0, 2.0, 1, stress_pips=0)["status"] == "ambiguous"
  expired = simulate_candidate_path(expired_profile, 1.0, 2.0, 1, stress_pips=0)
  assert expired["status"] == "expired"
  assert round(expired["grossResultR"], 6) == 0.5


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


def test_v12_strict_units_and_past_only_forecast_quality_preserve_bad_raw_value() -> None:
  assert compare_source_values_strict("200K", "200") is None
  outcomes = []
  for index in range(12):
    event = score_event(calendar_event(index + 1, 100 + index, "EUR", "Consumer Confidence", "-15.5", "-16.0", "-15.9"), get_signal_definition(SENTIMENT_VERSION_ID))
    assert event is not None
    outcomes.append({**candidate("long", 100 + index), "events": [event]})
  bad = score_event(calendar_event(99, 200, "EUR", "Consumer Confidence", "-15.5", "0.1", "-15.9"), get_signal_definition(SENTIMENT_VERSION_ID))
  assert bad is not None and bad["score"] == 0
  rescored, audit = _rescore_policy_outcomes([*outcomes, {**candidate("long", 200), "events": [bad]}], "forecast_quality")
  final_event = rescored[-1]["events"][0]
  assert final_event["forecast"] == "0.1"
  assert final_event["forecastSuspect"] is True
  assert final_event["surprisePoint"] is None
  assert final_event["momentumPoint"] == 1
  assert final_event["score"] == 1
  assert audit["excludedForecastCount"] == 1


def test_policy_rescore_preserves_non_eurusd_base_currency_direction() -> None:
  definition = get_signal_definition("FMS-USDCAD-LABOR-H4-v2")
  assert definition is not None
  package = build_signal_candidates([
    calendar_event(1, 100, "USD", "Continuing Jobless Claims", "1778", "1790", "1799"),
    calendar_event(2, 100, "USD", "Initial Jobless Claims", "203", "216", "206"),
    calendar_event(3, 100, "USD", "Initial Jobless Claims 4-Week Average", "205.5", "208.459", "204"),
  ], now=200, definition=definition)[0]

  assert package["direction"] == "long"
  rescored, _audit = _rescore_policy_outcomes([package], "forecast_quality")
  assert [event["score"] for event in rescored[0]["events"]] == [3, 3, 0]
  assert rescored[0]["direction"] == "long"
  assert rescored[0]["pairVote"] == 1


def test_every_supported_pair_currency_orientation_survives_all_scoring_policies() -> None:
  market_specs = {
    "EURUSD": ("EUR", "USD", {"EUR": frozenset({"EU"}), "USD": frozenset({"US"})}),
    **MARKET_RESEARCH_SPECS,
  }
  policies = ("baseline", "surprise_only", "momentum_only", "agreement_no_bonus", "forecast_quality")
  for market, (base, quote, country_scope) in market_specs.items():
    definition = get_signal_definition(MARKET_SOURCE_VERSION_IDS[market][3])
    assert definition is not None
    for currency, expected_improvement, expected_weakening in (
      (base, "long", "short"),
      (quote, "short", "long"),
    ):
      country = sorted(country_scope[currency])[0]
      for actual, expected in (("2", expected_improvement), ("0", expected_weakening)):
        for titles in (("GDP q/q",), ("GDP q/q", "GDP y/y")):
          sources = [{
            **calendar_event(index, 100, currency, title, actual, "1", "1"),
            "countryCode": country,
          } for index, title in enumerate(titles, start=1)]
          package = build_signal_candidates(sources, now=200, definition=definition)[0]
          assert package["pairBaseCurrency"] == base
          assert package["pairQuoteCurrency"] == quote
          assert package["direction"] == expected, (market, currency, actual, titles, "baseline")
          for policy in policies:
            rescored, _audit = _rescore_policy_outcomes([package], policy)
            assert rescored[0]["direction"] == expected, (market, currency, actual, titles, policy)


def test_v11_revision_audit_uses_prior_exact_series_actual_without_replacing_broker_previous() -> None:
  packages = build_signal_candidates([
    calendar_event(1, 100, "USD", "Industrial Production m/m", "0.1", "0.0", "-0.1"),
    calendar_event(2, 200, "USD", "Industrial Production m/m", "0.2", "0.3", "0.3"),
  ], now=300, definition=get_signal_definition(GROWTH_VERSION_ID))
  annotated = _annotate_numeric_robustness(packages)

  assert annotated[0]["numericRobustness"]["revisionReliability"] == "incomplete"
  assert annotated[1]["events"][0]["previous"] == "0.3"
  assert annotated[1]["events"][0]["priorArchivedActual"] == "0.1"
  assert annotated[1]["events"][0]["momentumPoint"] == -1
  assert annotated[1]["events"][0]["archivedMomentumPoint"] == 1
  assert annotated[1]["numericRobustness"]["revisionReliability"] == "sensitive"


def test_relative_magnitude_uses_only_earlier_releases_of_the_same_exact_series() -> None:
  events = [
    calendar_event(index, 100 + index, "USD", "Industrial Production m/m", str(index + 1), "0", "0")
    for index in range(1, 15)
  ]
  events.append(calendar_event(99, 200, "USD", "Industrial Production y/y", "100", "0", "0"))
  packages = build_signal_candidates(events, now=300, definition=get_signal_definition(GROWTH_VERSION_ID))
  annotated = _annotate_numeric_robustness(packages)
  monthly = next(row for row in annotated if row["eventTime"] == 114)["events"][0]
  annual = next(row for row in annotated if row["eventTime"] == 200)["events"][0]

  assert monthly["surpriseMagnitude"]["status"] == "ready"
  assert monthly["surpriseMagnitude"]["priorCount"] == 13
  assert monthly["surpriseMagnitude"]["category"] == "exceptional"
  assert annual["surpriseMagnitude"]["status"] == "insufficient"
  assert annual["surpriseMagnitude"]["priorCount"] == 0


def test_v11_package_completeness_separates_full_partial_and_single_packages() -> None:
  pattern = {
    "requiredExactTitles": ("Core PPI m/m", "Core PPI y/y", "PPI m/m", "PPI y/y"),
  }
  event = lambda title: {"currency": "USD", "scoreGroup": "producer_inflation", "title": title}
  full = {"events": [event(title) for title in pattern["requiredExactTitles"]]}
  partial = {"events": [event("Core PPI m/m"), event("PPI m/m")]}
  single = {"events": [event("PPI m/m")]}

  assert _package_completeness(full, pattern) == "full"
  assert _package_completeness(partial, pattern) == "partial"
  assert _package_completeness(single, pattern) == "single"


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
  assert CHART_SIGNAL_MODEL_ID == "FMS-EURUSD-FORECAST-GUARD-H4-v13"
  assert pattern["sourceVersion"] == GROWTH_VERSION_ID
  assert pattern["signatures"] == ("short|USD:industrial_output",)
  assert pattern["current"] is True


def test_v13_retains_payroll_and_only_the_complete_us_ppi_cooling_package() -> None:
  payroll = next(row for row in CHART_SIGNAL_PATTERN_DEFINITIONS if row["id"] == "us-payroll-short")
  ppi = next(row for row in CHART_SIGNAL_PATTERN_DEFINITIONS if row["id"] == "us-producer-inflation-cooling-long")
  assert payroll["execution"] == {"stopAtr": 2.0, "targetR": 1.0, "expiryCandles": 6}
  assert ppi["execution"] == {"stopAtr": 2.0, "targetR": 1.25, "expiryCandles": 18}

  complete = {
    **candidate(direction="long"),
    "events": [
      {"currency": "USD", "scoreGroup": "producer_inflation", "title": title}
      for title in ("Core PPI m/m", "Core PPI y/y", "PPI m/m", "PPI y/y")
    ],
  }
  partial = {**complete, "events": complete["events"][:-1]}
  assert candidate_matches_chart_pattern(complete, ppi) is True
  assert candidate_matches_chart_pattern(partial, ppi) is False


def test_registered_rejection_inverts_direction_only_after_raw_package_match() -> None:
  raw = {
    **candidate(direction="long"),
    "pairVote": 2,
    "numericRobustness": {"relativeMagnitude": "ordinary"},
  }
  pattern = {
    "reaction": "contrarian",
    "signatures": [candidate_pattern_signature(raw)],
    "cohort": {"dimension": "relativeMagnitude", "value": "ordinary"},
  }
  assert candidate_matches_chart_pattern(raw, pattern) is True
  assert candidate_matches_chart_pattern({**raw, "numericRobustness": {"relativeMagnitude": "large"}}, pattern) is False
  transformed = apply_chart_pattern_reaction(raw, pattern)
  assert transformed["direction"] == "short"
  assert transformed["pairVote"] == -2
  assert raw["direction"] == "long"


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


def test_candidate_evaluation_uses_the_registered_per_setup_exit_contract() -> None:
  rows = candles()
  atr = calculate_atr_by_candle(rows)
  result = evaluate_candidate(
    candidate(), rows, [row["time"] for row in rows], atr, 1.25,
    stop_atr=2.0, holding_candles=18,
  )

  assert result["stopAtr"] == 2.0
  assert result["targetR"] == 1.25
  assert result["expiryCandles"] == 18
  assert round(abs(result["entry"] - result["stop"]), 10) == round(abs(result["target"] - result["entry"]) / 1.25, 10)


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


def test_workbench_single_contract_preserves_signature_and_declared_execution() -> None:
  definition = get_signal_definition(V2_VERSION_ID)
  candle_rows = candles(count=150)
  events = [{
    **calendar_event(
      index,
      14_400 * (20 + index * 2) + 1,
      "EUR",
      "Unemployment Rate",
      str(4.5 - index * 0.01),
      str(4.6 - index * 0.01),
      str(4.7 - index * 0.01),
    ),
    "countryCode": "EU",
  } for index in range(1, 41)]
  outcomes = build_signal_candidates(events, now=14_400 * 149, definition=definition)
  signature = candidate_pattern_signature(outcomes[0])

  result = build_workbench_experiment(
    [{
      "versionId": V2_VERSION_ID,
      "outcomes": outcomes,
      "splitTime": int(outcomes[28]["eventTime"]),
      "generatedAt": 14_400 * 149,
    }],
    candle_rows,
    {
      "sourceVersionId": V2_VERSION_ID,
      "signature": signature,
      "requiredExactTitles": ["Unemployment Rate"],
      "scoringPolicy": "baseline",
      "cohort": {"dimension": "none", "value": "all"},
      "reaction": "continuation",
      "execution": {
        "mode": "single",
        "stopAtrValues": [1.0],
        "targetRValues": [2.0],
        "holdingCandles": [30],
      },
    },
    generated_at=14_400 * 150,
  )

  assert result["signature"] == signature
  assert result["selection"] == "single_declared_contract"
  assert result["configurationsTested"] == 1
  assert result["selectedConfiguration"]["stopAtr"] == 1.0
  assert result["selectedConfiguration"]["targetR"] == 2.0
  assert result["selectedConfiguration"]["holdingCandles"] == 30
  assert result["limitations"][1].startswith("The simulation is gross")
  assert result["rawAudit"]["selectedContractKey"] == "1|2|30"
  assert result["rawAudit"]["contracts"][0]["targetAtr"] == 2.0
  assert result["rawAudit"]["cases"][0]["events"][0]["actual"] is not None
  assert result["rawAudit"]["cases"][0]["events"][0]["surpriseRaw"] is not None
  assert result["rawAudit"]["cases"][0]["events"][0]["momentumRaw"] is not None
  assert result["requiredExactTitles"] == ["unemployment rate"]
  selected_results = result["rawAudit"]["contractResults"]["1|2|30"]
  assert selected_results[0]["pathAudit"]["maximumFavorableR"] >= 0
  assert selected_results[0]["pathAudit"]["maximumAdverseR"] >= 0
  assert selected_results[0]["pathAudit"]["fixedHorizonResponses"]

  combined_outcomes = [
    {**outcome, "direction": "short", "pairVote": -abs(int(outcome.get("pairVote") or 1))}
    if index % 2 else outcome
    for index, outcome in enumerate(outcomes)
  ]
  signatures = sorted({candidate_pattern_signature(outcome) for outcome in combined_outcomes})
  combined = build_workbench_experiment(
    [{
      "versionId": V2_VERSION_ID,
      "outcomes": combined_outcomes,
      "splitTime": int(combined_outcomes[28]["eventTime"]),
      "generatedAt": 14_400 * 149,
    }],
    candle_rows,
    {
      "sourceVersionId": V2_VERSION_ID,
      "signature": signatures[0],
      "signatures": signatures,
      "directionSelection": "both",
      "scoringPolicy": "baseline",
      "cohort": {"dimension": "none", "value": "all"},
      "reaction": "continuation",
      "execution": {
        "mode": "single",
        "stopAtrValues": [1.0],
        "targetRValues": [2.0],
        "holdingCandles": [30],
      },
    },
    generated_at=14_400 * 150,
  )
  assert combined["directionSelection"] == "both"
  assert combined["signatures"] == signatures
  assert combined["historicalN"] == result["historicalN"]
