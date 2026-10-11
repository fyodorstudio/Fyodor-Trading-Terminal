//+------------------------------------------------------------------+
//|                                FyodorResearchExporterV4.mq5      |
//|  Explicit-symbol MT5 calendar and H1 research exporter           |
//+------------------------------------------------------------------+
#property copyright   "Fyodor Math Lab"
#property link        "https://github.com/fyodorstudio/lab"
#property version     "4.00"
#property description "Explicit-symbol MT5 calendar and H1 OHLC research exporter."
#property description "Preserves raw calendar values and records pair coverage and provenance."
#property script_show_inputs
#property strict

#define EXPORTER_VERSION "4.0.0"
#define SCHEMA_VERSION   "fyodor-mt5-research-export/4.0.0"

input group "=== Export Scope ==="
input bool              ExportCalendar         = true;
input bool              ExportRequestedBars    = true;
input string            CalendarCurrencies     = "USD,EUR,GBP,JPY,AUD,CAD,CHF,NZD";
input datetime          CalendarFromDate       = D'2015.01.01 00:00:00';
input datetime          CalendarToDate         = 0;  // 0 = trade-server snapshot time
input datetime          CandleFromDate         = D'2014.11.01 00:00:00'; // ATR warmup for early 2015
input datetime          CandleToDate           = 0;  // 0 = trade-server snapshot time
input ENUM_TIMEFRAMES   CandleTimeframe        = PERIOD_H1;
input string            RequestedBrokerSymbols = "AUDUSD,EURUSD,GBPUSD,NZDUSD,USDCAD,USDCHF,USDJPY,AUDCAD,AUDCHF,AUDJPY,AUDNZD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,NZDCAD,NZDCHF,NZDJPY";
input bool              RequireExact28PairSet  = true; // Set false only for a separate exploratory export

input group "=== Reliability ==="
input int               RequestRetries         = 8;
input int               RetryDelayMilliseconds = 1500;
input bool              ExcludeIncompleteBar   = true;
input bool              ExportOnlyForexSymbols = true;
input bool              StopOnCalendarError    = true;

input group "=== Output ==="
input string            OutputRootPrefix       = "FyodorResearchExport_v4";
input bool              SaveToCommonFolder     = true;
input bool              ShowCompletionDialog   = true;

struct CalendarExportResult
  {
   int events;
   int releases;
   int countries_failed;
   int event_queries_failed;
   int currencies_without_events;
   int value_queries_failed;
   int event_id_mismatches;
   bool completed;
  };

struct CandleExportResult
  {
   int symbols_seen;
   int symbols_skipped;
   int symbols_exported;
   int symbols_failed;
   int missing_required_pairs;
   int partial_coverage_symbols;
   long bars_exported;
   bool completed;
  };

datetime g_snapshot_server=0;
datetime g_snapshot_gmt=0;
datetime g_calendar_to=0;
datetime g_candle_to=0;
string   g_export_id="";
string   g_export_root="";
int      g_file_flags=0;
string   g_missing_required_pairs="";

// The approved first-pass FX universe. RequestedBrokerSymbols may contain
// broker suffixes, but the resulting canonical base+quote set must match this.
const string REQUIRED_PAIRS="AUDUSD,EURUSD,GBPUSD,NZDUSD,USDCAD,USDCHF,USDJPY,AUDCAD,AUDCHF,AUDJPY,AUDNZD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,NZDCAD,NZDCHF,NZDJPY";
const string REQUIRED_CALENDAR_CURRENCIES="USD,EUR,GBP,JPY,AUD,CAD,CHF,NZD";

#include "research-export/csv-formatting.mqh"
#include "research-export/calendar-rows.mqh"
#include "research-export/calendar-export.mqh"
#include "research-export/candle-query.mqh"
#include "research-export/candle-export.mqh"
#include "research-export/manifest.mqh"

void OnStart()
  {
   Print("==================================================================");
   Print(" FYODOR RESEARCH EXPORTER v4 - EXPLICIT FX RESEARCH EXPORT");
   Print("==================================================================");

   if(!TerminalInfoInteger(TERMINAL_CONNECTED))
     {
      const string error="MT5 is not connected to a trade server. Export aborted.";
      Print("ERROR: "+error);
      if(ShowCompletionDialog)
         MessageBox(error,"Fyodor Research Exporter",MB_OK|MB_ICONERROR);
      return;
     }

   g_snapshot_server=TimeTradeServer();
   g_snapshot_gmt=TimeGMT();
   if(g_snapshot_server<=0)
     {
      const string error="TimeTradeServer returned an invalid snapshot time. Export aborted.";
      Print("ERROR: "+error);
      if(ShowCompletionDialog)
         MessageBox(error,"Fyodor Research Exporter",MB_OK|MB_ICONERROR);
      return;
     }

   g_calendar_to=(CalendarToDate>0 ? CalendarToDate : g_snapshot_server);
   g_candle_to=(CandleToDate>0 ? CandleToDate : g_snapshot_server);
   if((ExportCalendar && CalendarFromDate>=g_calendar_to) ||
      (ExportRequestedBars && CandleFromDate>=g_candle_to))
     {
      const string error="An export start date is not earlier than its resolved end date.";
      Print("ERROR: "+error);
      if(ShowCompletionDialog)
         MessageBox(error,"Fyodor Research Exporter",MB_OK|MB_ICONERROR);
      return;
     }
   if(ExportRequestedBars && CandleTimeframe!=PERIOD_H1)
     {
      const string error="This research export is H1-only. Set CandleTimeframe to PERIOD_H1.";
      Print("ERROR: "+error);
      if(ShowCompletionDialog)
         MessageBox(error,"Fyodor Research Exporter",MB_OK|MB_ICONERROR);
      return;
     }
   if(RequireExact28PairSet && ExportRequestedBars)
     {
      string requested_symbols[];
      const int requested_count=StringSplit(RequestedBrokerSymbols,',',requested_symbols);
      if(requested_count!=28)
        {
         const string error=StringFormat("Exact FX study requires 28 requested broker symbols; received %d.",requested_count);
         Print("ERROR: "+error);
         if(ShowCompletionDialog)
            MessageBox(error,"Fyodor Research Exporter",MB_OK|MB_ICONERROR);
         return;
        }
     }
   if(RequireExact28PairSet && ExportCalendar)
     {
      string requested_currencies[];
      string required_currencies[];
      const int requested_count=StringSplit(CalendarCurrencies,',',requested_currencies);
      const int required_count=StringSplit(REQUIRED_CALENDAR_CURRENCIES,',',required_currencies);
      bool currencies_ok=(requested_count==required_count);
      string seen_currencies[];
      for(int c=0;c<requested_count;c++)
        {
         string currency=requested_currencies[c];
         StringTrimLeft(currency);
         StringTrimRight(currency);
         StringToUpper(currency);
         if(!StringArrayContains(required_currencies,currency) ||
            StringArrayContains(seen_currencies,currency))
            currencies_ok=false;
         StringArrayAppend(seen_currencies,currency);
        }
      if(!currencies_ok)
        {
         const string error="Exact FX study requires each of USD, EUR, GBP, JPY, AUD, CAD, CHF and NZD exactly once in CalendarCurrencies.";
         Print("ERROR: "+error);
         if(ShowCompletionDialog)
            MessageBox(error,"Fyodor Research Exporter",MB_OK|MB_ICONERROR);
         return;
        }
     }

   g_export_id=CompactTimestamp(g_snapshot_server)+"_"+IntegerToString((int)GetTickCount());
   g_export_root=SafeFileToken(OutputRootPrefix)+"_"+g_export_id+"_server";
   g_file_flags=SaveToCommonFolder ? FILE_COMMON : 0;
   // A run marker is created before any other output so a repeated launch
   // cannot silently reuse and overwrite the same export folder.
   if(FileIsExist(g_export_root+"\\run_started.csv",g_file_flags))
     {
      Print("ERROR: Export run ID already exists; refusing to overwrite it: "+g_export_root);
      return;
     }
   const int marker=OpenCsv("run_started.csv");
   if(marker==INVALID_HANDLE)
      return;
   FileWrite(marker,"export_id","snapshot_trade_server_timestamp","exporter_version");
   FileWrite(marker,CsvText(g_export_id),Int64String((long)g_snapshot_server),EXPORTER_VERSION);
   FileClose(marker);

   const uint started=GetTickCount();
   CalendarExportResult calendar_result;
   CandleExportResult candle_result;
   ZeroMemory(calendar_result);
   ZeroMemory(candle_result);

   if(ExportCalendar)
      calendar_result=ExportEconomicCalendar();
   else
      calendar_result.completed=true;

   if(ExportRequestedBars)
      candle_result=ExportCandles();
   else
      candle_result.completed=true;

   const uint elapsed=GetTickCount()-started;
   WriteManifest(calendar_result,candle_result,elapsed);

   const bool success=calendar_result.completed && candle_result.completed &&
                      candle_result.partial_coverage_symbols==0;
   Print("==================================================================");
   PrintFormat(" Export folder: %s",g_export_root);
   PrintFormat(" Calendar: %d events, %d releases, complete=%s",
               calendar_result.events,calendar_result.releases,BoolString(calendar_result.completed));
   PrintFormat(" Candles: %d symbols, %s bars, complete=%s",
               candle_result.symbols_exported,Int64String(candle_result.bars_exported),BoolString(candle_result.completed));
   PrintFormat(" Missing required pairs: %d (%s); partial-coverage symbols: %d",
               candle_result.missing_required_pairs,g_missing_required_pairs,candle_result.partial_coverage_symbols);
   PrintFormat(" Elapsed: %.1f seconds",(double)elapsed/1000.0);
   Print(" Copy the ENTIRE export folder without renaming or editing files.");
   Print("==================================================================");

   if(ShowCompletionDialog)
     {
      const string message=StringFormat(
         "Export %s\n\nFolder: %s\nCalendar releases: %d\nCandle symbols: %d\nMissing required pairs: %d\nPartial-coverage symbols: %d\nCandle bars: %s\n\nCopy the entire folder unchanged.",
         success ? "completed" : "completed with warnings",g_export_root,
         calendar_result.releases,candle_result.symbols_exported,
         candle_result.missing_required_pairs,candle_result.partial_coverage_symbols,
         Int64String(candle_result.bars_exported));
      MessageBox(message,"Fyodor Research Exporter v4",MB_OK|(success ? MB_ICONINFORMATION : MB_ICONWARNING));
     }
  }
//+------------------------------------------------------------------+
