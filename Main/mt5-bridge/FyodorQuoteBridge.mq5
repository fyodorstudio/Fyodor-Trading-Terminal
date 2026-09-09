//+------------------------------------------------------------------+
//| FyodorQuoteBridge.mq5                                            |
//| Publish broker-native quote snapshots to Fyodor without using    |
//| the Python MetaTrader5 history/IPC lane. This EA never trades.    |
//+------------------------------------------------------------------+
#property strict

input string QuoteBridgeUrl         = "http://127.0.0.1:8001/quotes_ingest";
input int    PublishIntervalMs      = 500;
input int    FullSnapshotIntervalSec = 30;
input int    RequestTimeoutMs       = 1000;

string PublisherId = "";
string LastCatalogRevision = "";
ulong  Sequence = 0;
ulong  LastFullSnapshotMsc = 0;
bool   ForceFullSnapshot = true;
int    LastHttpStatus = 0;

string LastNames[];
long   LastTickTimes[];
double LastBids[];
double LastAsks[];
double LastChanges[];
bool   LastHasTicks[];
bool   LastHasChanges[];
bool   LastVisible[];
bool   LastSelected[];
bool   LastSynchronized[];

string JsonEscape(string value)
{
   StringReplace(value, "\\", "\\\\");
   StringReplace(value, "\"", "\\\"");
   StringReplace(value, "\r", "\\r");
   StringReplace(value, "\n", "\\n");
   StringReplace(value, "\t", "\\t");
   return value;
}

string JsonString(string value)
{
   return "\"" + JsonEscape(value) + "\"";
}

string JsonBool(bool value)
{
   return value ? "true" : "false";
}

string JsonDoubleOrNull(bool available, double value, int precision)
{
   if(!available || !MathIsValidNumber(value))
      return "null";
   return DoubleToString(value, MathMax(0, MathMin(10, precision)));
}

ulong HashText(ulong hash, string value)
{
   const ulong prime = 1099511628211;
   int length = StringLen(value);
   for(int i = 0; i < length; i++)
   {
      hash ^= (ulong)StringGetCharacter(value, i);
      hash *= prime;
   }
   return hash;
}

string BuildCatalogRevision(string &names[], string &paths[], int &digits[])
{
   ulong hash = 1469598103934665603;
   int count = ArraySize(names);
   hash = HashText(hash, IntegerToString(count));
   for(int i = 0; i < count; i++)
   {
      hash = HashText(hash, names[i]);
      hash = HashText(hash, "|");
      hash = HashText(hash, paths[i]);
      hash = HashText(hash, "|");
      hash = HashText(hash, IntegerToString(digits[i]));
      hash = HashText(hash, ";");
   }
   return StringFormat("%d-%I64u", count, hash);
}

string BuildQuoteRow(
   string name,
   string path,
   int digits,
   bool hasTick,
   MqlTick &tick,
   bool hasChange,
   double priceChange,
   bool visible,
   bool selected,
   bool synchronized
)
{
   string row = "{";
   row += "\"name\":" + JsonString(name);
   row += ",\"path\":" + JsonString(path);
   row += ",\"bid\":" + JsonDoubleOrNull(hasTick, tick.bid, digits);
   row += ",\"ask\":" + JsonDoubleOrNull(hasTick, tick.ask, digits);
   row += ",\"price_change\":" + JsonDoubleOrNull(hasChange, priceChange, 8);
   row += ",\"digits\":" + IntegerToString(digits);
   row += ",\"quote_time\":" + (hasTick ? StringFormat("%I64d", (long)tick.time) : "null");
   row += ",\"visible\":" + JsonBool(visible);
   row += ",\"selected\":" + JsonBool(selected);
   row += ",\"synchronized\":" + JsonBool(synchronized);
   row += "}";
   return row;
}

bool PostQuotes(string payload, int &status)
{
   uchar data[];
   int written = StringToCharArray(payload, data, 0, StringLen(payload), CP_UTF8);
   int dataSize = written;
   if(dataSize > 0 && data[dataSize - 1] == 0)
      dataSize--;

   uchar result[];
   string resultHeaders;
   string headers = "Content-Type: application/json\r\n";
   ResetLastError();
   status = WebRequest(
      "POST",
      QuoteBridgeUrl,
      headers,
      "",
      MathMax(100, RequestTimeoutMs),
      data,
      dataSize,
      result,
      resultHeaders
   );
   return status >= 200 && status < 300;
}

void CopyCurrentState(
   string &names[],
   long &tickTimes[],
   double &bids[],
   double &asks[],
   double &changes[],
   bool &hasTicks[],
   bool &hasChanges[],
   bool &visible[],
   bool &selected[],
   bool &synchronized[]
)
{
   ArrayCopy(LastNames, names);
   ArrayCopy(LastTickTimes, tickTimes);
   ArrayCopy(LastBids, bids);
   ArrayCopy(LastAsks, asks);
   ArrayCopy(LastChanges, changes);
   ArrayCopy(LastHasTicks, hasTicks);
   ArrayCopy(LastHasChanges, hasChanges);
   ArrayCopy(LastVisible, visible);
   ArrayCopy(LastSelected, selected);
   ArrayCopy(LastSynchronized, synchronized);
}

int OnInit()
{
   PublisherId = StringFormat("fyodor-quotes-%I64d-%I64u", (long)ChartID(), GetTickCount64());
   int interval = MathMax(250, PublishIntervalMs);
   if(!EventSetMillisecondTimer(interval))
   {
      PrintFormat("FyodorQuoteBridge: unable to start %d ms timer error=%d", interval, GetLastError());
      return INIT_FAILED;
   }
   PrintFormat("FyodorQuoteBridge initialized. Bridge=%s IntervalMs=%d FullSnapshotSec=%d",
               QuoteBridgeUrl, interval, MathMax(1, FullSnapshotIntervalSec));
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   PrintFormat("FyodorQuoteBridge deinitialized. reason=%d", reason);
}

void OnTimer()
{
   int count = SymbolsTotal(false);
   if(count <= 0)
      return;

   string names[];
   string paths[];
   int digits[];
   long tickTimes[];
   double bids[];
   double asks[];
   double changes[];
   bool hasTicks[];
   bool hasChanges[];
   bool visible[];
   bool selected[];
   bool synchronized[];

   ArrayResize(names, count);
   ArrayResize(paths, count);
   ArrayResize(digits, count);
   ArrayResize(tickTimes, count);
   ArrayResize(bids, count);
   ArrayResize(asks, count);
   ArrayResize(changes, count);
   ArrayResize(hasTicks, count);
   ArrayResize(hasChanges, count);
   ArrayResize(visible, count);
   ArrayResize(selected, count);
   ArrayResize(synchronized, count);

   MqlTick ticks[];
   ArrayResize(ticks, count);

   for(int i = 0; i < count; i++)
   {
      names[i] = SymbolName(i, false);
      paths[i] = SymbolInfoString(names[i], SYMBOL_PATH);
      digits[i] = (int)SymbolInfoInteger(names[i], SYMBOL_DIGITS);
      hasTicks[i] = SymbolInfoTick(names[i], ticks[i]);
      tickTimes[i] = hasTicks[i] ? ticks[i].time_msc : 0;
      bids[i] = hasTicks[i] ? ticks[i].bid : 0.0;
      asks[i] = hasTicks[i] ? ticks[i].ask : 0.0;

      ResetLastError();
      changes[i] = SymbolInfoDouble(names[i], SYMBOL_PRICE_CHANGE);
      hasChanges[i] = GetLastError() == 0 && MathIsValidNumber(changes[i]);
      visible[i] = (bool)SymbolInfoInteger(names[i], SYMBOL_VISIBLE);
      selected[i] = (bool)SymbolInfoInteger(names[i], SYMBOL_SELECT);
      synchronized[i] = SymbolIsSynchronized(names[i]);
   }

   string revision = BuildCatalogRevision(names, paths, digits);
   ulong nowMsc = GetTickCount64();
   bool sameCatalog = revision == LastCatalogRevision && ArraySize(LastNames) == count;
   bool periodicFull = LastFullSnapshotMsc == 0
      || nowMsc - LastFullSnapshotMsc >= (ulong)MathMax(1, FullSnapshotIntervalSec) * 1000;
   bool complete = ForceFullSnapshot || !sameCatalog || periodicFull;

   string rowsJson = "";
   int changedCount = 0;
   for(int i = 0; i < count; i++)
   {
      bool changed = complete;
      if(!complete)
      {
         changed = names[i] != LastNames[i]
            || tickTimes[i] != LastTickTimes[i]
            || hasTicks[i] != LastHasTicks[i]
            || (hasTicks[i] && (bids[i] != LastBids[i] || asks[i] != LastAsks[i]))
            || hasChanges[i] != LastHasChanges[i]
            || (hasChanges[i] && changes[i] != LastChanges[i])
            || visible[i] != LastVisible[i]
            || selected[i] != LastSelected[i]
            || synchronized[i] != LastSynchronized[i];
      }
      if(!changed)
         continue;

      if(changedCount > 0)
         rowsJson += ",";
      rowsJson += BuildQuoteRow(
         names[i], paths[i], digits[i], hasTicks[i], ticks[i], hasChanges[i], changes[i],
         visible[i], selected[i], synchronized[i]
      );
      changedCount++;
   }

   ulong nextSequence = Sequence + 1;
   string payload = "{";
   payload += "\"publisher_id\":" + JsonString(PublisherId);
   payload += ",\"broker_identity\":" + JsonString(
      TerminalInfoString(TERMINAL_COMPANY) + "|" + TerminalInfoString(TERMINAL_NAME)
   );
   payload += ",\"catalog_revision\":" + JsonString(revision);
   payload += ",\"sequence\":" + StringFormat("%I64u", nextSequence);
   payload += ",\"complete\":" + JsonBool(complete);
   payload += ",\"sent_at\":" + StringFormat("%I64d", (long)TimeGMT());
   payload += ",\"rows\":[" + rowsJson + "]}";

   int status = 0;
   bool ok = PostQuotes(payload, status);
   if(!ok)
   {
      ForceFullSnapshot = true;
      if(status != LastHttpStatus)
         PrintFormat("FyodorQuoteBridge: publish failed status=%d error=%d; next payload will be complete",
                     status, GetLastError());
      LastHttpStatus = status;
      return;
   }

   Sequence = nextSequence;
   LastCatalogRevision = revision;
   ForceFullSnapshot = false;
   if(complete)
   {
      LastFullSnapshotMsc = nowMsc;
      PrintFormat("FyodorQuoteBridge: complete snapshot accepted symbols=%d sequence=%I64u", count, Sequence);
   }
   else if(LastHttpStatus < 200 || LastHttpStatus >= 300)
   {
      PrintFormat("FyodorQuoteBridge: publishing recovered sequence=%I64u", Sequence);
   }
   LastHttpStatus = status;
   CopyCurrentState(
      names, tickTimes, bids, asks, changes, hasTicks, hasChanges, visible, selected, synchronized
   );
}
