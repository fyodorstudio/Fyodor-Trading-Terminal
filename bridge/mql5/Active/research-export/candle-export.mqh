CandleExportResult ExportCandles()
  {
   CandleExportResult result;
   ZeroMemory(result);

   const int manifest_handle=OpenCsv("candle_symbols.csv");
   if(manifest_handle==INVALID_HANDLE)
      return result;

   FileWrite(manifest_handle,
      "source_symbol","canonical_symbol","output_file","timeframe",
      "calculation_mode","calculation_mode_code","symbol_digits","point","currency_base","currency_profit",
      "bars_copied","bars_written","earliest_bar_timestamp",
      "latest_bar_timestamp","earliest_bar_server_text","latest_bar_server_text",
      "requested_from","requested_to","coverage_starts_after_requested","coverage_ends_before_available_terminal_history",
      "excluded_incomplete_bars","copy_error","status","chart_price_basis"
   );

   string requested_symbols[];
   const int total_symbols=StringSplit(RequestedBrokerSymbols,',',requested_symbols);
   result.symbols_seen=total_symbols;
   if(total_symbols<=0)
     {
      Print("ERROR: RequestedBrokerSymbols is empty.");
      FileClose(manifest_handle);
      return result;
     }
   string required_pairs[];
   const int required_count=StringSplit(REQUIRED_PAIRS,',',required_pairs);
   const int period_seconds=PeriodSeconds(CandleTimeframe);
   if(period_seconds<=0)
     {
      Print("ERROR: CandleTimeframe has no valid PeriodSeconds value.");
      FileClose(manifest_handle);
      return result;
     }

   string used_output_files[];
   string requested_seen[];
   string canonical_seen[];
   string successful_canonicals[];
   const string timeframe=TimeframeToken();

   for(int i=0;i<total_symbols;i++)
     {
      string symbol=requested_symbols[i];
      StringTrimLeft(symbol);
      StringTrimRight(symbol);
      if(symbol=="")
        {
         result.symbols_failed++;
         WriteCandleFailure(manifest_handle,symbol,"",timeframe,"empty_requested_symbol",0);
         continue;
        }
      if(StringArrayContains(requested_seen,symbol))
        {
         result.symbols_failed++;
         WriteCandleFailure(manifest_handle,symbol,"",timeframe,"duplicate_requested_symbol",0);
         continue;
        }
      StringArrayAppend(requested_seen,symbol);
      ResetLastError();
      if(!SymbolSelect(symbol,true))
        {
         const int select_error=GetLastError();
         result.symbols_failed++;
         WriteCandleFailure(manifest_handle,symbol,"",timeframe,"symbol_select_failed",select_error);
         continue;
        }

      const ENUM_SYMBOL_CALC_MODE calculation_mode=
         (ENUM_SYMBOL_CALC_MODE)SymbolInfoInteger(symbol,SYMBOL_TRADE_CALC_MODE);
      const bool is_forex=(calculation_mode==SYMBOL_CALC_MODE_FOREX ||
                           calculation_mode==SYMBOL_CALC_MODE_FOREX_NO_LEVERAGE);
      if(ExportOnlyForexSymbols && !is_forex)
        {
         result.symbols_skipped++;
         FileWrite(manifest_handle,
            CsvText(symbol),"","",CsvText(timeframe),
            EnumToString(calculation_mode),IntegerToString((int)calculation_mode),
            IntegerToString((int)SymbolInfoInteger(symbol,SYMBOL_DIGITS)),
            DoubleToString(SymbolInfoDouble(symbol,SYMBOL_POINT),16),
            CsvText(SymbolInfoString(symbol,SYMBOL_CURRENCY_BASE)),
            CsvText(SymbolInfoString(symbol,SYMBOL_CURRENCY_PROFIT)),
            "0","0","","","","",
            Int64String((long)CandleFromDate),Int64String((long)g_candle_to),
            "","","0","0","skipped_non_forex",CsvText(ChartPriceBasis(symbol))
         );
         continue;
        }

      const string canonical=CanonicalSymbolToken(symbol);
      if(RequireExact28PairSet && !StringArrayContains(required_pairs,canonical))
        {
         result.symbols_failed++;
         WriteCandleFailure(manifest_handle,symbol,canonical,timeframe,"outside_required_28_pairs",0);
         continue;
        }
      if(StringArrayContains(canonical_seen,canonical))
        {
         result.symbols_failed++;
         WriteCandleFailure(manifest_handle,symbol,canonical,timeframe,"duplicate_canonical_pair",0);
         continue;
        }
      StringArrayAppend(canonical_seen,canonical);
      string output_file="candles\\candles_"+canonical+"_"+timeframe+".csv";
      if(StringArrayContains(used_output_files,output_file))
         output_file="candles\\candles_"+canonical+"_"+IntegerToString(i)+"_"+timeframe+".csv";
      StringArrayAppend(used_output_files,output_file);

      MqlRates rates[];
      ArraySetAsSeries(rates,false);
      int copy_error=0;
      const int copied=LoadRates(symbol,rates,copy_error);
      if(copied<=0)
        {
         result.symbols_failed++;
         FileWrite(manifest_handle,
            CsvText(symbol),CsvText(canonical),CsvText(output_file),CsvText(timeframe),
            EnumToString(calculation_mode),IntegerToString((int)calculation_mode),
            IntegerToString((int)SymbolInfoInteger(symbol,SYMBOL_DIGITS)),
            DoubleToString(SymbolInfoDouble(symbol,SYMBOL_POINT),16),
            CsvText(SymbolInfoString(symbol,SYMBOL_CURRENCY_BASE)),
            CsvText(SymbolInfoString(symbol,SYMBOL_CURRENCY_PROFIT)),
            IntegerToString(MathMax(0,copied)),"0","","","","",
            Int64String((long)CandleFromDate),Int64String((long)g_candle_to),
            "","","0",IntegerToString(copy_error),copied<0 ? "copy_failed" : "no_bars",CsvText(ChartPriceBasis(symbol))
         );
         continue;
        }

      const int candle_handle=OpenCsv(output_file);
      if(candle_handle==INVALID_HANDLE)
        {
         result.symbols_failed++;
         FileWrite(manifest_handle,
            CsvText(symbol),CsvText(canonical),CsvText(output_file),CsvText(timeframe),
            EnumToString(calculation_mode),IntegerToString((int)calculation_mode),
            IntegerToString((int)SymbolInfoInteger(symbol,SYMBOL_DIGITS)),
            DoubleToString(SymbolInfoDouble(symbol,SYMBOL_POINT),16),
            CsvText(SymbolInfoString(symbol,SYMBOL_CURRENCY_BASE)),
            CsvText(SymbolInfoString(symbol,SYMBOL_CURRENCY_PROFIT)),
            IntegerToString(copied),"0","","","","",
            Int64String((long)CandleFromDate),Int64String((long)g_candle_to),
            "","","0",IntegerToString(GetLastError()),"file_open_failed",CsvText(ChartPriceBasis(symbol))
         );
         continue;
        }

      FileWrite(candle_handle,
         "time","open","high","low","close","tick_volume","spread","real_volume",
         "source_symbol","time_server_text","timestamp_convention","complete_at_export"
      );

      const int digits=(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS);
      int written=0;
      int excluded=0;
      datetime earliest=0;
      datetime latest=0;

      for(int b=0;b<copied;b++)
        {
         const bool complete_at_snapshot=((long)rates[b].time+(long)period_seconds<=(long)g_snapshot_server);
         const bool complete_in_request=((long)rates[b].time+(long)period_seconds<=(long)g_candle_to);
         if(ExcludeIncompleteBar && (!complete_at_snapshot || !complete_in_request))
           {
            excluded++;
            continue;
           }

         FileWrite(candle_handle,
            Int64String((long)rates[b].time),
            DoubleToString(rates[b].open,digits),
            DoubleToString(rates[b].high,digits),
            DoubleToString(rates[b].low,digits),
            DoubleToString(rates[b].close,digits),
            Int64String(rates[b].tick_volume),
            IntegerToString(rates[b].spread),
            Int64String(rates[b].real_volume),
            CsvText(symbol),
            ServerTimeText(rates[b].time),
            "trade_server_time",
            BoolString(complete_at_snapshot)
         );
         if(written==0)
            earliest=rates[b].time;
         latest=rates[b].time;
         written++;
         if((written%10000)==0)
            FileFlush(candle_handle);
        }

      FileFlush(candle_handle);
      FileClose(candle_handle);

      // A seven-day tolerance avoids labelling a normal weekend immediately
      // after CandleFromDate as missing history. Interior gaps are audited later.
      const bool starts_late=(written>0 && (long)earliest>(long)CandleFromDate+7*86400);
      const datetime terminal_last=(datetime)SeriesInfoInteger(symbol,CandleTimeframe,SERIES_LASTBAR_DATE);
      const datetime expected_last=(terminal_last<g_candle_to ? terminal_last : g_candle_to);
      // One newer terminal bar can be the incomplete bar intentionally excluded.
      const bool ends_early=(written>0 && terminal_last>0 &&
                             (long)latest+(long)period_seconds<(long)expected_last);
      FileWrite(manifest_handle,
         CsvText(symbol),CsvText(canonical),CsvText(output_file),CsvText(timeframe),
         EnumToString(calculation_mode),IntegerToString((int)calculation_mode),IntegerToString(digits),
         DoubleToString(SymbolInfoDouble(symbol,SYMBOL_POINT),digits),
         CsvText(SymbolInfoString(symbol,SYMBOL_CURRENCY_BASE)),
         CsvText(SymbolInfoString(symbol,SYMBOL_CURRENCY_PROFIT)),
         IntegerToString(copied),IntegerToString(written),
         written>0 ? Int64String((long)earliest) : "",
         written>0 ? Int64String((long)latest) : "",
         ServerTimeText(earliest),ServerTimeText(latest),
         Int64String((long)CandleFromDate),Int64String((long)g_candle_to),
         BoolString(starts_late),BoolString(ends_early),IntegerToString(excluded),
         IntegerToString(copy_error),written>0 ? "ok" : "no_complete_bars",
         CsvText(ChartPriceBasis(symbol))
      );

      if(written>0)
        {
         result.symbols_exported++;
         result.bars_exported+=(long)written;
         StringArrayAppend(successful_canonicals,canonical);
         if(starts_late || ends_early)
            result.partial_coverage_symbols++;
        }
      else
         result.symbols_failed++;

      PrintFormat("Candles %s -> %s: copied %d, wrote %d, excluded %d",
                  symbol,output_file,copied,written,excluded);
     }

   if(RequireExact28PairSet)
      for(int r=0;r<required_count;r++)
         if(!StringArrayContains(successful_canonicals,required_pairs[r]))
           {
            result.missing_required_pairs++;
            if(g_missing_required_pairs!="") g_missing_required_pairs+=",";
            g_missing_required_pairs+=required_pairs[r];
            WriteCandleFailure(manifest_handle,"",required_pairs[r],timeframe,"required_pair_missing",0);
           }

   FileFlush(manifest_handle);
   FileClose(manifest_handle);
   result.completed=(result.symbols_exported>0 && result.symbols_failed==0 &&
                     result.missing_required_pairs==0);
   return result;
  }

//+------------------------------------------------------------------+
//| Key/value provenance manifest                                   |
//+------------------------------------------------------------------+
