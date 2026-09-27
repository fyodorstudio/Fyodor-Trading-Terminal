//+------------------------------------------------------------------+
//|                                           FyodorMasterExport.mq5 |
//|        One-Time Master Historical Exporter for Calendar & Market |
//|                                  Copyright 2026, Fyodor Terminal |
//+------------------------------------------------------------------+
#property copyright   "Fyodor Terminal"
#property link        "https://github.com/fyodorstudio/fyodor-terminal"
#property version     "2.00"
#property description "One-time complete export of MT5 economic calendar history and OHLC candles."
#property description "Generates 100% real broker data with zero simulation, synthetic seeds, or mocks."
#property script_show_inputs
#property strict

//--- INPUT PARAMETERS ---
input group "=== Calendar Export Settings ==="
input bool     ExportCalendar         = true;                      // Export Complete Economic Calendar
input datetime CalendarFromDate       = D'2015.01.01 00:00';        // Calendar Start Date
input datetime CalendarToDate         = D'2030.01.01 00:00';        // Calendar End Date
input string   CalendarCurrencies     = "USD,EUR,GBP,JPY,AUD,CAD,CHF,NZD"; // Target Currencies
input string   CalendarOutputFile     = "fyodor_calendar_master_history.csv"; // Output CSV filename

input group "=== OHLC Candle Export Settings ==="
input bool     ExportMarketWatchBars  = true;                      // Export All Visible Market Watch Symbols
input ENUM_TIMEFRAMES CandleTimeframe = PERIOD_H1;                 // Timeframe to Export (H1 for crisp reaction)
input int      BarsToExport           = 50000;                     // Number of Bars Per Symbol (Max available)
input string   CandlesSubfolder       = "fyodor_candles";          // Subfolder for candle CSVs

input group "=== Storage Location ==="
input bool     SaveToCommonFolder     = true;                      // Save to Terminal/Common/Files (Recommended)

//+------------------------------------------------------------------+
//| Helper: Escape CSV string values                                 |
//+------------------------------------------------------------------+
string CsvEscape(string s)
{
   StringReplace(s, "\"", "\"\"");
   return "\"" + s + "\"";
}

//+------------------------------------------------------------------+
//| Helper: Format raw calendar scaled integers to clean decimals    |
//+------------------------------------------------------------------+
string FormatCalendarValue(long raw, int digits)
{
   if(raw == LONG_MIN || raw == -9223372036854775808LL)
      return "";

   double v = (double)raw / 1000000.0;
   if(digits < 0 || digits > 8)
      digits = 2;

   return DoubleToString(v, digits);
}

//+------------------------------------------------------------------+
//| Helper: Importance string from integer enum                      |
//+------------------------------------------------------------------+
string ImportanceString(int importance)
{
   if(importance <= 0) return "low";
   if(importance == 1) return "medium";
   return "high";
}

//+------------------------------------------------------------------+
//| Helper: Country code resolution                                  |
//+------------------------------------------------------------------+
string GetCountryCode(const MqlCalendarEvent &ce, const string currency)
{
   MqlCalendarCountry country;
   ResetLastError();
   if(CalendarCountryById((ulong)ce.country_id, country))
   {
      string code = country.code;
      StringTrimLeft(code);
      StringTrimRight(code);
      StringToUpper(code);
      if(code != "")
         return code;
   }

   string cur = currency;
   StringToUpper(cur);
   if(cur == "USD") return "US";
   if(cur == "EUR") return "EU";
   if(cur == "GBP") return "GB";
   if(cur == "JPY") return "JP";
   if(cur == "AUD") return "AU";
   if(cur == "CAD") return "CA";
   if(cur == "NZD") return "NZ";
   if(cur == "CHF") return "CH";
   if(StringLen(cur) >= 2) return StringSubstr(cur, 0, 2);
   return cur;
}

//+------------------------------------------------------------------+
//| Export Economic Calendar                                         |
//+------------------------------------------------------------------+
int DoCalendarExport(int fileFlags)
{
   Print(">>> [1/2] Starting Economic Calendar Export...");
   PrintFormat("    Window: %s to %s | Currencies: %s", 
               TimeToString(CalendarFromDate), TimeToString(CalendarToDate), CalendarCurrencies);

   int handle = FileOpen(CalendarOutputFile, FILE_WRITE | FILE_CSV | FILE_ANSI | fileFlags, ',');
   if(handle == INVALID_HANDLE)
   {
      PrintFormat("ERROR: Failed to open calendar file '%s' for writing. Error code: %d", CalendarOutputFile, GetLastError());
      return 0;
   }

   // Write CSV Header
   FileWrite(handle,
      "event_id",
      "value_id",
      "timestamp",
      "currency",
      "country_code",
      "event_name",
      "importance",
      "actual",
      "forecast",
      "previous",
      "revised_previous"
   );

   string currencies[];
   int curCount = StringSplit(CalendarCurrencies, ',', currencies);
   int totalRecords = 0;

   for(int c = 0; c < curCount; c++)
   {
      string cur = currencies[c];
      StringTrimLeft(cur);
      StringTrimRight(cur);
      StringToUpper(cur);
      if(cur == "") continue;

      MqlCalendarEvent events[];
      ResetLastError();
      int eventCount = CalendarEventByCurrency(cur, events);
      if(eventCount <= 0)
      {
         PrintFormat("    No calendar event definitions found for currency %s (Code: %d)", cur, GetLastError());
         continue;
      }

      int curRecords = 0;
      for(int e = 0; e < eventCount; e++)
      {
         MqlCalendarEvent ce = events[e];
         string countryCode = GetCountryCode(ce, cur);

         MqlCalendarValue vals[];
         ResetLastError();
         int valCount = CalendarValueHistoryByEvent(ce.id, vals, CalendarFromDate, CalendarToDate);
         if(valCount <= 0) continue;

         for(int v = 0; v < valCount; v++)
         {
            MqlCalendarValue val = vals[v];
            string actualStr    = FormatCalendarValue(val.actual_value, (int)ce.digits);
            string forecastStr  = FormatCalendarValue(val.forecast_value, (int)ce.digits);
            string prevStr      = FormatCalendarValue(val.prev_value, (int)ce.digits);
            string revPrevStr   = FormatCalendarValue(val.revised_prev_value, (int)ce.digits);
            string impStr       = ImportanceString((int)ce.importance);

            FileWrite(handle,
               IntegerToString((int)ce.id),
               IntegerToString((int)val.id),
               IntegerToString((long)val.time),
               cur,
               countryCode,
               ce.name,
               impStr,
               actualStr,
               forecastStr,
               prevStr,
               revPrevStr
            );
            totalRecords++;
            curRecords++;
         }
      }
      PrintFormat("    Currency %s: Exported %d historical releases.", cur, curRecords);
   }

   FileClose(handle);
   PrintFormat(">>> [1/2] Economic Calendar Export COMPLETE! Total releases exported: %d", totalRecords);
   return totalRecords;
}

//+------------------------------------------------------------------+
//| Export OHLC Candles for all Visible Market Watch Symbols         |
//+------------------------------------------------------------------+
int DoMarketWatchCandleExport(int fileFlags)
{
   Print(">>> [2/2] Starting Market Watch OHLC Candles Export...");
   int totalSymbols = SymbolsTotal(true); // visible in Market Watch
   PrintFormat("    Found %d visible symbols in Market Watch. Target timeframe: %s | Max bars: %d",
               totalSymbols, EnumToString(CandleTimeframe), BarsToExport);

   string tfName = StringSubstr(EnumToString(CandleTimeframe), 7); // Strip "PERIOD_"
   int exportedSymbols = 0;

   for(int i = 0; i < totalSymbols; i++)
   {
      string sym = SymbolName(i, true);
      ResetLastError();

      // Ensure symbol is synchronized
      if(!SymbolInfoInteger(sym, SYMBOL_SELECT))
         SymbolSelect(sym, true);

      MqlRates rates[];
      ArraySetAsSeries(rates, false);
      int copied = CopyRates(sym, CandleTimeframe, 0, BarsToExport, rates);
      if(copied <= 0)
      {
         PrintFormat("    Warning: Could not copy rates for %s (Error %d)", sym, GetLastError());
         continue;
      }

      string cleanSym = sym;
      StringReplace(cleanSym, ".", "_");
      StringReplace(cleanSym, "#", "_");
      StringReplace(cleanSym, "/", "_");

      string fileName = CandlesSubfolder + "/candles_" + cleanSym + "_" + tfName + ".csv";
      int handle = FileOpen(fileName, FILE_WRITE | FILE_CSV | FILE_ANSI | fileFlags, ',');
      if(handle == INVALID_HANDLE)
      {
         PrintFormat("    Warning: Failed to create candle file '%s' (Error %d)", fileName, GetLastError());
         continue;
      }

      FileWrite(handle, "time", "open", "high", "low", "close", "tick_volume", "spread", "real_volume");

      for(int b = 0; b < copied; b++)
      {
         FileWrite(handle,
            IntegerToString((long)rates[b].time),
            DoubleToString(rates[b].open, (int)SymbolInfoInteger(sym, SYMBOL_DIGITS)),
            DoubleToString(rates[b].high, (int)SymbolInfoInteger(sym, SYMBOL_DIGITS)),
            DoubleToString(rates[b].low, (int)SymbolInfoInteger(sym, SYMBOL_DIGITS)),
            DoubleToString(rates[b].close, (int)SymbolInfoInteger(sym, SYMBOL_DIGITS)),
            IntegerToString(rates[b].tick_volume),
            IntegerToString(rates[b].spread),
            IntegerToString(rates[b].real_volume)
         );
      }

      FileClose(handle);
      exportedSymbols++;

      if(exportedSymbols % 25 == 0 || exportedSymbols == totalSymbols)
      {
         PrintFormat("    Progress: [%d / %d] symbols exported...", exportedSymbols, totalSymbols);
      }
   }

   PrintFormat(">>> [2/2] Candle Export COMPLETE! Total symbols exported: %d of %d", exportedSymbols, totalSymbols);
   return exportedSymbols;
}

//+------------------------------------------------------------------+
//| Script Program Start Function                                    |
//+------------------------------------------------------------------+
void OnStart()
{
   Print("==================================================================");
   Print("   FYODOR MASTER EXPORT: 100% REAL BROKER DATA EXPORT STARTED    ");
   Print("==================================================================");

   int fileFlags = SaveToCommonFolder ? FILE_COMMON : 0;
   uint startTime = GetTickCount();

   int calendarCount = 0;
   int symbolCount   = 0;

   if(ExportCalendar)
      calendarCount = DoCalendarExport(fileFlags);

   if(ExportMarketWatchBars)
      symbolCount = DoMarketWatchCandleExport(fileFlags);

   uint elapsedMs = GetTickCount() - startTime;
   double elapsedSec = elapsedMs / 1000.0;

   string storageLocation = SaveToCommonFolder 
      ? "Terminal Common Files folder (Terminal/Common/Files)" 
      : "MT5 Terminal Data folder (MQL5/Files)";

   Print("==================================================================");
   Print("               FYODOR MASTER EXPORT COMPLETED!                    ");
   PrintFormat("  - Economic Calendar Releases: %d records", calendarCount);
   PrintFormat("  - Market Watch Symbols Exported: %d symbols", symbolCount);
   PrintFormat("  - Elapsed Time: %.2f seconds", elapsedSec);
   PrintFormat("  - Destination Folder: %s", storageLocation);
   Print("==================================================================");

   string msg = StringFormat("Fyodor Master Export Finished!\n\nCalendar Events: %d\nSymbols: %d\nTime: %.1fs\n\nFiles saved to:\n%s",
                             calendarCount, symbolCount, elapsedSec, storageLocation);
   MessageBox(msg, "Fyodor Master Export Successful", MB_OK | MB_ICONINFORMATION);
}
//+------------------------------------------------------------------+
