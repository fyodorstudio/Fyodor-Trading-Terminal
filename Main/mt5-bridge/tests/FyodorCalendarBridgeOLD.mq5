//+------------------------------------------------------------------+
//| FyodorCalendarBridge.mq5                                         |
//| Push MT5 economic calendar data to a local HTTP bridge.          |
//+------------------------------------------------------------------+
#property strict

//--- Inputs
input string BridgeUrl        = "http://127.0.0.1:8001/calendar_ingest";
input string CurrenciesList   = "USD,EUR,GBP,JPY,AUD,CAD,NZD,CHF";
input int    LookBackDays     = 400;   // how many days back to include
input int    LookAheadDays    = 90;    // how many days ahead to include
input int    PollIntervalSec  = 60;    // timer interval in seconds
input int    MaxEventsPerCur  = 1000;  // safety cap per currency per tick
input int    MaxEventsPerPost = 120;   // send smaller HTTP batches for stability
input int    RequestTimeoutMs = 15000; // HTTP timeout per batch

//+------------------------------------------------------------------+
//| Helpers                                                          |
//+------------------------------------------------------------------+

// Map MT5 importance enum to frontend impact text
string ImpactFromImportance(int importance)
{
   if(importance <= 0) return "low";
   if(importance == 1) return "medium";
   return "high";
}

// Escape text safely for JSON.
// Any hidden control characters are replaced with a space.
string EscapeJsonString(const string s)
{
   string result = "";
   int len = StringLen(s);

   for(int i = 0; i < len; i++)
   {
      ushort ch = (ushort)StringGetCharacter(s, i);

      if(ch == 92)              // backslash
         result += "\\\\";
      else if(ch == 34)         // double quote
         result += "\\\"";
      else if(ch < 32)          // control character
         result += " ";
      else
         result += CharToString(ch);
   }

   return result;
}

// Format MT5 raw calendar value (scaled by 1e6) into a human-readable string
string FormatCalendarValue(long raw, int digits)
{
   if(raw == LONG_MIN) // no value
      return "";

   double v = (double)raw / 1000000.0;

   if(digits < 0 || digits > 8)
      digits = 2;

   return DoubleToString(v, digits);
}

// Map currency code to a 2-letter country/region code used by the app
string CountryCodeFromCurrency(string cur)
{
   StringToUpper(cur);

   if(cur == "USD") return "US";
   if(cur == "EUR") return "EU";
   if(cur == "GBP") return "GB";
   if(cur == "JPY") return "JP";
   if(cur == "AUD") return "AU";
   if(cur == "CAD") return "CA";
   if(cur == "NZD") return "NZ";
   if(cur == "CHF") return "CH";

   if(StringLen(cur) >= 2)
      return StringSubstr(cur, 0, 2);

   return cur;
}

// Trim spaces around a string
string Trim(const string s)
{
   int len = StringLen(s);
   int start = 0;

   while(start < len && StringGetCharacter(s, start) <= ' ')
      start++;

   int end = len - 1;
   while(end >= start && StringGetCharacter(s, end) <= ' ')
      end--;

   if(end < start)
      return "";

   return StringSubstr(s, start, end - start + 1);
}

// Append one JSON event into a comma-separated event list
void AppendEvent(string &accum, const string &eventJson)
{
   if(accum == "")
      accum = eventJson;
   else
      accum = accum + "," + eventJson;
}

// Check whether a calendar value field exists
bool HasActualValue(const MqlCalendarValue &val)
{
   return (val.actual_value != LONG_MIN);
}

bool HasPreviousValue(const MqlCalendarValue &val)
{
   return (val.prev_value != LONG_MIN);
}

bool HasForecastValue(const MqlCalendarValue &val)
{
   return (val.forecast_value != LONG_MIN);
}

bool HasAnyUsefulValue(const MqlCalendarValue &val)
{
   return HasActualValue(val) || HasPreviousValue(val) || HasForecastValue(val);
}

// Pick the best calendar value row for an event series.
// Priority:
// 1. latest past/released row with actual_value
// 2. nearest future row with prev_value
// 3. latest row with any useful value
// 4. final fallback: last row in the array
bool SelectBestCalendarValue(const MqlCalendarValue &vals[], int count, MqlCalendarValue &chosen)
{
   if(count <= 0)
      return false;

   datetime now = TimeCurrent();

   // 1. Latest released row with actual value
   for(int i = count - 1; i >= 0; i--)
   {
      if((datetime)vals[i].time <= now && HasActualValue(vals[i]))
      {
         chosen = vals[i];
         return true;
      }
   }

   // 2. Nearest future row with previous value
   for(int i = 0; i < count; i++)
   {
      if((datetime)vals[i].time > now && HasPreviousValue(vals[i]))
      {
         chosen = vals[i];
         return true;
      }
   }

   // 3. Latest row with any useful value at all
   for(int i = count - 1; i >= 0; i--)
   {
      if(HasAnyUsefulValue(vals[i]))
      {
         chosen = vals[i];
         return true;
      }
   }

   // 4. Fallback: just use the last row
   chosen = vals[count - 1];
   return true;
}

// Build one event JSON object from calendar event + chosen value row
string BuildEventJson(const string currency,
                      const MqlCalendarEvent &ce,
                      const MqlCalendarValue &val)
{
   long unixTime = (long)val.time;
   int  digits   = (int)ce.digits;

   string titleEsc    = EscapeJsonString(ce.name);
   string currencyEsc = EscapeJsonString(currency);
   string countryCode = EscapeJsonString(CountryCodeFromCurrency(currency));
   string impact      = EscapeJsonString(ImpactFromImportance((int)ce.importance));

   string actualStr   = EscapeJsonString(FormatCalendarValue(val.actual_value,   digits));
   string forecastStr = EscapeJsonString(FormatCalendarValue(val.forecast_value, digits));
   string prevStr     = EscapeJsonString(FormatCalendarValue(val.prev_value,     digits));

   string json = "{";
   json += "\"id\":"            + IntegerToString((int)ce.id) + ",";
   json += "\"time\":"          + IntegerToString((int)unixTime) + ",";
   json += "\"countryCode\":\"" + countryCode  + "\",";
   json += "\"currency\":\""    + currencyEsc  + "\",";
   json += "\"title\":\""       + titleEsc     + "\",";
   json += "\"impact\":\""      + impact       + "\",";
   json += "\"actual\":\""      + actualStr    + "\",";
   json += "\"forecast\":\""    + forecastStr  + "\",";
   json += "\"previous\":\""    + prevStr      + "\"";
   json += "}";

   return json;
}

// Send one batch: { "events": [ ... ] }
bool SendEventsToBridge(const string eventsJson, const int eventCount)
{
   if(eventsJson == "" || eventCount <= 0)
      return true;

   string body = "{\"events\":[" + eventsJson + "]}";

   uchar data[];
   int written = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   int data_size = written;

   if(data_size > 0 && data[data_size - 1] == 0)
      data_size--;

   uchar result[];
   string result_headers;
   string headers = "Content-Type: application/json\r\n";

   ResetLastError();

   int status = WebRequest("POST", BridgeUrl, headers, "", RequestTimeoutMs,
                           data, data_size, result, result_headers);
   int err = GetLastError();

   string response = CharArrayToString(result, 0, -1, CP_UTF8);

   PrintFormat("FyodorCalendarBridge: sent batch events=%d status=%d error=%d body=%s",
               eventCount, status, err, response);

   ResetLastError();

   return (status >= 200 && status < 300);
}

// Flush current batch, then reset it
bool FlushBatch(string &eventsJsonBatch,
                int &batchCount,
                int &successBatches,
                int &failedBatches)
{
   if(batchCount <= 0 || eventsJsonBatch == "")
      return true;

   bool ok = SendEventsToBridge(eventsJsonBatch, batchCount);

   if(ok)
      successBatches++;
   else
      failedBatches++;

   eventsJsonBatch = "";
   batchCount = 0;

   return ok;
}

//+------------------------------------------------------------------+
//| Standard EA entry points                                         |
//+------------------------------------------------------------------+

int OnInit()
{
   int timerSec = PollIntervalSec;
   if(timerSec < 1)
      timerSec = 1;

   EventSetTimer(timerSec);

   PrintFormat("FyodorCalendarBridge initialized. Bridge=%s LookBack=%d LookAhead=%d MaxEventsPerCur=%d MaxEventsPerPost=%d TimeoutMs=%d",
               BridgeUrl, LookBackDays, LookAheadDays, MaxEventsPerCur, MaxEventsPerPost, RequestTimeoutMs);

   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("FyodorCalendarBridge deinitialized.");
}

void OnTimer()
{
   datetime now      = TimeCurrent();
   datetime fromTime = now - LookBackDays  * 24 * 60 * 60;
   datetime toTime   = now + LookAheadDays * 24 * 60 * 60;

   string batchJson = "";
   int batchCount = 0;

   int totalCollected = 0;
   int successBatches = 0;
   int failedBatches = 0;

   string parts[];
   int curCount = StringSplit(CurrenciesList, ',', parts);
   if(curCount <= 0)
   {
      Print("FyodorCalendarBridge: CurrenciesList is empty.");
      return;
   }

   for(int ci = 0; ci < curCount; ci++)
   {
      string cur = Trim(parts[ci]);
      if(cur == "")
         continue;

      MqlCalendarEvent events[];
      ResetLastError();
      int total = CalendarEventByCurrency(cur, events);

      if(total <= 0)
      {
         PrintFormat("FyodorCalendarBridge: CalendarEventByCurrency(%s) returned %d. err=%d",
                     cur, total, GetLastError());
         ResetLastError();
         continue;
      }

      PrintFormat("FyodorCalendarBridge: %s events count=%d", cur, total);

      int processed = 0;

      for(int i = 0; i < total && processed < MaxEventsPerCur; i++)
      {
         MqlCalendarEvent ce = events[i];

         MqlCalendarValue vals[];
         int n = CalendarValueHistoryByEvent(ce.id, vals, fromTime, toTime);
         if(n <= 0)
            continue;

         MqlCalendarValue bestVal;
         if(!SelectBestCalendarValue(vals, n, bestVal))
            continue;

         string eventJson = BuildEventJson(cur, ce, bestVal);
         AppendEvent(batchJson, eventJson);

         batchCount++;
         totalCollected++;
         processed++;

         if(batchCount >= MaxEventsPerPost)
            FlushBatch(batchJson, batchCount, successBatches, failedBatches);
      }
   }

   // Send any leftover events
   FlushBatch(batchJson, batchCount, successBatches, failedBatches);

   PrintFormat("FyodorCalendarBridge: timer complete. collected=%d success_batches=%d failed_batches=%d",
               totalCollected, successBatches, failedBatches);
}
