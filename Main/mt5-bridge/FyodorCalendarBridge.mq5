//+------------------------------------------------------------------+
//| FyodorCalendarBridge.mq5                                         |
//| Push MT5 economic calendar data to the local HTTP bridge.        |
//|                                                                  |
//| This version preserves every (event id, event time) row so the   |
//| bridge and app can derive both current values and next schedules.|
//+------------------------------------------------------------------+
#property strict

input string BridgeUrl        = "http://127.0.0.1:8001/calendar_ingest";
input string CurrenciesList   = "USD,EUR,GBP,JPY,AUD,CAD,NZD,CHF";
input int    LookBackDays     = 400;
input int    LookAheadDays    = 90;
input int    PollIntervalSec  = 60;
input int    MaxEventsPerCur  = 1000;
input int    MaxRowsPerPost   = 120;
input int    RequestTimeoutMs = 15000;

string ImpactFromImportance(int importance)
{
   if(importance <= 0) return "low";
   if(importance == 1) return "medium";
   return "high";
}

string EscapeJsonString(const string s)
{
   string result = "";
   int len = StringLen(s);

   for(int i = 0; i < len; i++)
   {
      ushort ch = (ushort)StringGetCharacter(s, i);

      if(ch == 92)
         result += "\\\\";
      else if(ch == 34)
         result += "\\\"";
      else if(ch < 32)
         result += " ";
      else
         result += CharToString(ch);
   }

   return result;
}

string FormatCalendarValue(long raw, int digits)
{
   if(raw == LONG_MIN)
      return "";

   double v = (double)raw / 1000000.0;
   if(digits < 0 || digits > 8)
      digits = 2;

   return DoubleToString(v, digits);
}

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

string CountryCodeFromCurrencyFallback(string cur)
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

string CountryCodeFromEvent(const MqlCalendarEvent &ce, const string currency)
{
   MqlCalendarCountry country;
   ResetLastError();

   if(CalendarCountryById((ulong)ce.country_id, country))
   {
      string code = Trim(country.code);
      StringToUpper(code);
      if(code != "")
         return code;
   }

   ResetLastError();
   return CountryCodeFromCurrencyFallback(currency);
}

void AppendEvent(string &accum, const string &eventJson)
{
   if(accum == "")
      accum = eventJson;
   else
      accum = accum + "," + eventJson;
}

string BuildEventJson(const string currency,
                      const string countryCode,
                      const MqlCalendarEvent &ce,
                      const MqlCalendarValue &val)
{
   long unixTime = (long)val.time;
   int digits = (int)ce.digits;

   string titleEsc    = EscapeJsonString(ce.name);
   string currencyEsc = EscapeJsonString(currency);
   string countryEsc  = EscapeJsonString(countryCode);
   string impactEsc   = EscapeJsonString(ImpactFromImportance((int)ce.importance));

   string actualStr   = EscapeJsonString(FormatCalendarValue(val.actual_value, digits));
   string forecastStr = EscapeJsonString(FormatCalendarValue(val.forecast_value, digits));
   string prevStr     = EscapeJsonString(FormatCalendarValue(val.prev_value, digits));

   string json = "{";
   json += "\"id\":" + IntegerToString((int)ce.id) + ",";
   json += "\"time\":" + IntegerToString((int)unixTime) + ",";
   json += "\"countryCode\":\"" + countryEsc + "\",";
   json += "\"currency\":\"" + currencyEsc + "\",";
   json += "\"title\":\"" + titleEsc + "\",";
   json += "\"impact\":\"" + impactEsc + "\",";
   json += "\"actual\":\"" + actualStr + "\",";
   json += "\"forecast\":\"" + forecastStr + "\",";
   json += "\"previous\":\"" + prevStr + "\"";
   json += "}";

   return json;
}

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
   int status = WebRequest("POST", BridgeUrl, headers, "", RequestTimeoutMs, data, data_size, result, result_headers);
   int err = GetLastError();
   string response = CharArrayToString(result, 0, -1, CP_UTF8);

   PrintFormat("FyodorCalendarBridge: sent batch rows=%d status=%d error=%d body=%s",
               eventCount, status, err, response);

   ResetLastError();
   return (status >= 200 && status < 300);
}

bool FlushBatch(string &batchJson,
                int &batchCount,
                int &successBatches,
                int &failedBatches)
{
   if(batchCount <= 0 || batchJson == "")
      return true;

   bool ok = SendEventsToBridge(batchJson, batchCount);
   if(ok)
      successBatches++;
   else
      failedBatches++;

   batchJson = "";
   batchCount = 0;
   return ok;
}

int OnInit()
{
   EventSetTimer(MathMax(1, PollIntervalSec));
   PrintFormat("FyodorCalendarBridge initialized. Bridge=%s LookBack=%d LookAhead=%d MaxEventsPerCur=%d MaxRowsPerPost=%d TimeoutMs=%d",
               BridgeUrl, LookBackDays, LookAheadDays, MaxEventsPerCur, MaxRowsPerPost, RequestTimeoutMs);
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
   int totalRows = 0;
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
         string countryCode = CountryCodeFromEvent(ce, cur);

         MqlCalendarValue vals[];
         int n = CalendarValueHistoryByEvent(ce.id, vals, fromTime, toTime);
         if(n <= 0)
            continue;

         for(int vi = 0; vi < n; vi++)
         {
            string eventJson = BuildEventJson(cur, countryCode, ce, vals[vi]);
            AppendEvent(batchJson, eventJson);
            batchCount++;
            totalRows++;

            if(batchCount >= MaxRowsPerPost)
               FlushBatch(batchJson, batchCount, successBatches, failedBatches);
         }

         processed++;
      }
   }

   FlushBatch(batchJson, batchCount, successBatches, failedBatches);

   PrintFormat("FyodorCalendarBridge: timer complete. rows=%d success_batches=%d failed_batches=%d",
               totalRows, successBatches, failedBatches);
}
