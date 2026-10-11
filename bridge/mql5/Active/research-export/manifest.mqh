void ManifestRow(const int handle,const string key,const string value,const string note="")
  {
   FileWrite(handle,CsvText(key),CsvText(value),CsvText(note));
  }

void WriteManifest(const CalendarExportResult &calendar_result,
                   const CandleExportResult &candle_result,
                   const uint elapsed_ms)
  {
   const int handle=OpenCsv("manifest.csv");
   if(handle==INVALID_HANDLE)
      return;

   FileWrite(handle,"key","value","note");
   ManifestRow(handle,"schema_version",SCHEMA_VERSION);
   ManifestRow(handle,"exporter_version",EXPORTER_VERSION);
   ManifestRow(handle,"csv_text_encoding","RFC4180-style quoted UTF-8",
               "Embedded quotes are doubled and source line breaks are flattened to preserve one record per line.");
   ManifestRow(handle,"export_id",g_export_id);
   ManifestRow(handle,"export_root",g_export_root);
   ManifestRow(handle,"completed_elapsed_ms",IntegerToString((int)elapsed_ms));
   ManifestRow(handle,"snapshot_trade_server_timestamp",Int64String((long)g_snapshot_server));
   ManifestRow(handle,"snapshot_trade_server_text",ServerTimeText(g_snapshot_server));
   ManifestRow(handle,"snapshot_gmt_timestamp",Int64String((long)g_snapshot_gmt));
   ManifestRow(handle,"snapshot_gmt_text",TimeToString(g_snapshot_gmt,TIME_DATE|TIME_SECONDS));
   const long raw_offset=(long)g_snapshot_server-(long)g_snapshot_gmt;
   const long rounded_offset=(long)MathRound((double)raw_offset/60.0)*60;
   ManifestRow(handle,"trade_server_minus_gmt_seconds_snapshot",Int64String(rounded_offset),
               "Snapshot estimate only; retain timestamps as trade-server time and do not assume a fixed DST offset.");
   ManifestRow(handle,"timestamp_convention","trade_server_time",
               "MT5 calendar and bar timestamps are exported without UTC conversion.");

   ManifestRow(handle,"terminal_connected",BoolString((bool)TerminalInfoInteger(TERMINAL_CONNECTED)));
   ManifestRow(handle,"terminal_company",TerminalInfoString(TERMINAL_COMPANY));
   ManifestRow(handle,"terminal_name",TerminalInfoString(TERMINAL_NAME));
   ManifestRow(handle,"terminal_language",TerminalInfoString(TERMINAL_LANGUAGE));
   ManifestRow(handle,"terminal_build",IntegerToString((int)TerminalInfoInteger(TERMINAL_BUILD)));
   ManifestRow(handle,"terminal_max_bars",IntegerToString((int)TerminalInfoInteger(TERMINAL_MAXBARS)),
               "A low terminal Max bars setting can truncate requested candle history.");
   ManifestRow(handle,"account_company",AccountInfoString(ACCOUNT_COMPANY));
   ManifestRow(handle,"account_server",AccountInfoString(ACCOUNT_SERVER));
   ManifestRow(handle,"privacy_note","Account login and client name intentionally not exported.");

   ManifestRow(handle,"save_to_common_folder",BoolString(SaveToCommonFolder));
   ManifestRow(handle,"storage_scope",SaveToCommonFolder ? "Terminal/Common/Files" : "Terminal/MQL5/Files");
   ManifestRow(handle,"export_calendar",BoolString(ExportCalendar));
   ManifestRow(handle,"calendar_currencies",CalendarCurrencies);
   ManifestRow(handle,"calendar_from_timestamp",Int64String((long)CalendarFromDate));
   ManifestRow(handle,"calendar_from_server_text",ServerTimeText(CalendarFromDate));
   ManifestRow(handle,"calendar_to_timestamp",Int64String((long)g_calendar_to));
   ManifestRow(handle,"calendar_to_server_text",ServerTimeText(g_calendar_to));
   ManifestRow(handle,"calendar_events_exported",IntegerToString(calendar_result.events));
   ManifestRow(handle,"calendar_releases_exported",IntegerToString(calendar_result.releases));
   ManifestRow(handle,"calendar_country_lookup_failures",IntegerToString(calendar_result.countries_failed));
   ManifestRow(handle,"calendar_event_query_failures",IntegerToString(calendar_result.event_queries_failed));
   ManifestRow(handle,"calendar_currencies_without_events",IntegerToString(calendar_result.currencies_without_events));
   ManifestRow(handle,"calendar_value_query_failures",IntegerToString(calendar_result.value_queries_failed));
   ManifestRow(handle,"calendar_event_id_mismatches",IntegerToString(calendar_result.event_id_mismatches));
   ManifestRow(handle,"calendar_completed",BoolString(calendar_result.completed));

   ManifestRow(handle,"export_requested_bars",BoolString(ExportRequestedBars));
   ManifestRow(handle,"candle_timeframe",EnumToString(CandleTimeframe));
   ManifestRow(handle,"requested_broker_symbols",RequestedBrokerSymbols);
   ManifestRow(handle,"require_exact_28_pair_set",BoolString(RequireExact28PairSet));
   ManifestRow(handle,"required_canonical_pairs",RequireExact28PairSet ? REQUIRED_PAIRS : "");
   ManifestRow(handle,"candle_from_timestamp",Int64String((long)CandleFromDate));
   ManifestRow(handle,"candle_from_server_text",ServerTimeText(CandleFromDate));
   ManifestRow(handle,"candle_to_timestamp",Int64String((long)g_candle_to));
   ManifestRow(handle,"candle_to_server_text",ServerTimeText(g_candle_to));
   ManifestRow(handle,"exclude_incomplete_bar",BoolString(ExcludeIncompleteBar));
   ManifestRow(handle,"export_only_forex_symbols",BoolString(ExportOnlyForexSymbols),
               "Uses SYMBOL_TRADE_CALC_MODE and accepts FOREX and FOREX_NO_LEVERAGE modes.");
   ManifestRow(handle,"requested_broker_symbols_count",IntegerToString(candle_result.symbols_seen));
   ManifestRow(handle,"requested_symbols_skipped_non_forex",IntegerToString(candle_result.symbols_skipped));
   ManifestRow(handle,"candle_symbols_exported",IntegerToString(candle_result.symbols_exported));
   ManifestRow(handle,"candle_symbols_failed",IntegerToString(candle_result.symbols_failed));
   ManifestRow(handle,"missing_required_pairs_count",IntegerToString(candle_result.missing_required_pairs));
   ManifestRow(handle,"missing_required_pairs",g_missing_required_pairs);
   ManifestRow(handle,"partial_coverage_symbols",IntegerToString(candle_result.partial_coverage_symbols),
               "Inspect candle_symbols.csv and per-event path coverage; this is not a complete-history certification.");
   ManifestRow(handle,"candle_bars_exported",Int64String(candle_result.bars_exported));
   ManifestRow(handle,"candles_completed",BoolString(candle_result.completed));
   ManifestRow(handle,"request_retries",IntegerToString(RequestRetries));
   ManifestRow(handle,"retry_delay_milliseconds",IntegerToString(RetryDelayMilliseconds));
   ManifestRow(handle,"stop_on_calendar_error",BoolString(StopOnCalendarError));
   ManifestRow(handle,"checksum_note","Compute SHA-256 for every output file immediately after copying the folder from MT5.");

   FileFlush(handle);
   FileClose(handle);
  }

//+------------------------------------------------------------------+
//| Script entry point                                               |
//+------------------------------------------------------------------+
