//+------------------------------------------------------------------+
//| FyodorCalendarPublisherV2.mq5                                      |
//| Read-only MT5 economic-calendar publisher for the local bridge.  |
//+------------------------------------------------------------------+
#property strict
#property version   "2.02"
#property description "Publisher v2.0.2: frozen bridge protocol plus resumable local calendar backfill."
#property description "This EA contains no order or position functions."

input string BridgeUrl = "http://127.0.0.1:8001/api/v1/calendar/ingest";
input int SnapshotDaysBack = 30;
input int SnapshotDaysAhead = 60;
input int PollSeconds = 1;
input int HeartbeatSeconds = 10;
input int RetrySeconds = 5;
input int RequestTimeoutMilliseconds = 2500;
input int EventsPerChunk = 100;
input string StorageUrl = "http://127.0.0.1:8002/api/v1";
input bool EnableAutomaticBackfill = true;
input int BackfillPollSeconds = 5;

ulong g_change_id = 0;
bool g_change_id_ready = false;
bool g_snapshot_ready = false;
datetime g_last_heartbeat_attempt = 0;
datetime g_last_snapshot_attempt = 0;
string g_instance_id = "";
uint g_last_request_duration_ms = 0;

string JsonEscape(string value)
  {
   StringReplace(value,"\\","\\\\");
   StringReplace(value,"\"","\\\"");
   StringReplace(value,"\r","\\r");
   StringReplace(value,"\n","\\n");
   StringReplace(value,"\t","\\t");
   return value;
  }

string JsonString(const string value)
  {
   return "\""+JsonEscape(value)+"\"";
  }

string ULongString(const ulong value)
  {
   return StringFormat("%I64u",value);
  }

string ImportanceName(const ENUM_CALENDAR_EVENT_IMPORTANCE importance)
  {
   if(importance==CALENDAR_IMPORTANCE_LOW) return "low";
   if(importance==CALENDAR_IMPORTANCE_MODERATE) return "medium";
   if(importance==CALENDAR_IMPORTANCE_HIGH) return "high";
   return "none";
  }

string ImpactName(const ENUM_CALENDAR_EVENT_IMPACT impact)
  {
   if(impact==CALENDAR_IMPACT_POSITIVE) return "positive";
   if(impact==CALENDAR_IMPACT_NEGATIVE) return "negative";
   return "none";
  }

string OptionalCalendarNumber(const bool available,const double value,const uint digits)
  {
   if(!available) return "null";
   return DoubleToString(value,(int)MathMin(digits,8));
  }

long ServerUtcOffsetSeconds()
  {
   return (long)TimeTradeServer()-(long)TimeGMT();
  }

string EnvelopePrefix(const string kind,const string change_id,const datetime server_now)
  {
   datetime window_from=server_now-(datetime)(SnapshotDaysBack*86400);
   datetime window_to=server_now+(datetime)(SnapshotDaysAhead*86400);
   return "{"
          "\"protocol_version\":1,"
          "\"kind\":"+JsonString(kind)+","
          "\"instance_id\":"+JsonString(g_instance_id)+","
          "\"sent_at_local_seconds\":"+IntegerToString((long)TimeLocal())+","
          "\"server_time_seconds\":"+IntegerToString((long)server_now)+","
          "\"gmt_time_seconds\":"+IntegerToString((long)TimeGMT())+","
          "\"server_utc_offset_seconds\":"+IntegerToString(ServerUtcOffsetSeconds())+","
          "\"window_from_server_seconds\":"+IntegerToString((long)window_from)+","
          "\"window_to_server_seconds\":"+IntegerToString((long)window_to)+","
          "\"previous_request_duration_ms\":"+IntegerToString((long)g_last_request_duration_ms)+","
          "\"change_id\":"+JsonString(change_id)+",";
  }

bool CalendarValueJson(const MqlCalendarValue &value,string &json,const bool for_storage=false)
  {
   MqlCalendarEvent event;
   ResetLastError();
   if(!CachedEvent(value.event_id,event))
     {
      PrintFormat("Fyodor calendar: CalendarEventById(%s) failed: %d",ULongString(value.event_id),GetLastError());
      return false;
     }

   MqlCalendarCountry country;
   ResetLastError();
   if(!CachedCountry(event.country_id,country))
     {
      PrintFormat("Fyodor calendar: CalendarCountryById(%s) failed: %d",ULongString(event.country_id),GetLastError());
      return false;
     }

   json="{"
        "\"value_id\":"+JsonString(ULongString(value.id))+","
        "\"event_id\":"+JsonString(ULongString(value.event_id))+","
        "\"server_time_seconds\":"+IntegerToString((long)value.time)+","
        "\"period_seconds\":"+IntegerToString((long)value.period)+","
        "\"revision\":"+IntegerToString(value.revision)+","
        "\"currency\":"+JsonString(country.currency)+","
        "\"country_code\":"+JsonString(country.code)+","
        "\"country_name\":"+JsonString(country.name)+","
        "\"name\":"+JsonString(event.name)+","
        "\"event_code\":"+JsonString(event.event_code)+","
        "\"importance\":"+JsonString(ImportanceName(event.importance))+","
        "\"unit\":"+IntegerToString((int)event.unit)+","
        "\"multiplier\":"+IntegerToString((int)event.multiplier)+","
        "\"digits\":"+IntegerToString((int)event.digits)+","
        "\"time_mode\":"+IntegerToString((int)event.time_mode)+","
        "\"impact\":"+JsonString(ImpactName(value.impact_type))+","
        "\"actual\":"+OptionalCalendarNumber(value.HasActualValue(),value.GetActualValue(),event.digits)+","
        "\"forecast\":"+OptionalCalendarNumber(value.HasForecastValue(),value.GetForecastValue(),event.digits)+","
        "\"previous\":"+OptionalCalendarNumber(value.HasPreviousValue(),value.GetPreviousValue(),event.digits)+","
        "\"revised_previous\":"+OptionalCalendarNumber(value.HasRevisedValue(),value.GetRevisedValue(),event.digits)
        +(for_storage ? RawValuesJson(value) : "")+"}";
   return true;
  }

bool PostJson(const string json)
  {
   char request[];
   char response[];
   string response_headers;
   int copied=StringToCharArray(json,request,0,WHOLE_ARRAY,CP_UTF8);
   if(copied>0) ArrayResize(request,copied-1);
   string headers="Content-Type: application/json\r\nX-Fyodor-Calendar-Protocol: 1\r\n";
   ResetLastError();
   uint request_started=GetTickCount();
   int status=WebRequest("POST",BridgeUrl,headers,RequestTimeoutMilliseconds,request,response,response_headers);
   g_last_request_duration_ms=GetTickCount()-request_started;
   string response_body=CharArrayToString(response,0,-1,CP_UTF8);
   if(status==200)
     {
      if(StringFind(response_body,"\"snapshot_required\":true")>=0)
         g_snapshot_ready=false;
      return true;
     }
   if(status==-1)
     {
      PrintFormat("Fyodor calendar: bridge request failed: %d. Confirm WebRequest URL permission for http://127.0.0.1:8001",GetLastError());
     }
   else
     {
      PrintFormat("Fyodor calendar: bridge returned HTTP %d: %s",status,response_body);
     }
   return false;
  }

bool PostHeartbeat()
  {
   datetime server_now=TimeTradeServer();
   string json=EnvelopePrefix("heartbeat",ULongString(g_change_id),server_now)+
               "\"snapshot_id\":null,\"chunk_index\":0,\"chunk_count\":1,\"events\":[]}";
   return PostJson(json);
  }

bool PostValuesChunk(const string kind,
                     const string snapshot_id,
                     const MqlCalendarValue &values[],
                     const int start_index,
                     const int end_index,
                     const int chunk_index,
                     const int chunk_count,
                     const ulong change_id,
                     const datetime server_now)
  {
   string json=EnvelopePrefix(kind,ULongString(change_id),server_now);
   if(kind=="snapshot") json+="\"snapshot_id\":"+JsonString(snapshot_id)+",";
   else json+="\"snapshot_id\":null,";
   json+="\"chunk_index\":"+IntegerToString(chunk_index)+",";
   json+="\"chunk_count\":"+IntegerToString(chunk_count)+",\"events\":[";

   bool first=true;
   for(int index=start_index; index<end_index; index++)
     {
      string event_json;
      if(!CalendarValueJson(values[index],event_json)) return false;
      if(!first) json+=",";
      json+=event_json;
      first=false;
     }
   json+="]}";
   return PostJson(json);
  }

bool InitializeChangeId()
  {
   MqlCalendarValue ignored[];
   ulong candidate=0;
   ResetLastError();
   int received=CalendarValueLast(candidate,ignored);
   int error=GetLastError();
   if(received<0 || error!=0)
     {
      PrintFormat("Fyodor calendar: change ID initialization failed: %d",error);
      return false;
     }
   g_change_id=candidate;
   g_change_id_ready=true;
   PrintFormat("Fyodor calendar: change ID initialized: %s",ULongString(g_change_id));
   return true;
  }

bool PublishSnapshot()
  {
   datetime now=TimeTradeServer();
   datetime from=now-(datetime)(SnapshotDaysBack*86400);
   datetime to=now+(datetime)(SnapshotDaysAhead*86400);
   MqlCalendarValue values[];
   ResetLastError();
   int received=CalendarValueHistory(values,from,to);
   if(received<0)
     {
      PrintFormat("Fyodor calendar: CalendarValueHistory failed: %d",GetLastError());
      return false;
     }

   int chunk_size=(int)MathMax(1,EventsPerChunk);
   int chunk_count=(int)MathMax(1,(received+chunk_size-1)/chunk_size);
   string snapshot_id=g_instance_id+"-"+IntegerToString((long)now)+"-"+ULongString(g_change_id);
   for(int chunk=0; chunk<chunk_count; chunk++)
     {
      int start=chunk*chunk_size;
      int end=(int)MathMin(received,start+chunk_size);
      if(!PostValuesChunk("snapshot",snapshot_id,values,start,end,chunk,chunk_count,g_change_id,now))
         return false;
     }
   PrintFormat("Fyodor calendar: published atomic snapshot with %d values in %d chunks",received,chunk_count);
   return true;
  }

bool PublishChanges()
  {
   MqlCalendarValue values[];
   ulong previous_change_id=g_change_id;
   ulong candidate=g_change_id;
   ResetLastError();
   int received=CalendarValueLast(candidate,values);
   int error=GetLastError();
   if(received<0 || error!=0)
     {
      PrintFormat("Fyodor calendar: CalendarValueLast failed: %d",error);
      return false;
     }
   if(received==0)
     {
      g_change_id=candidate;
      return true;
     }

   datetime now=TimeTradeServer();
   int chunk_size=(int)MathMax(1,EventsPerChunk);
   int chunk_count=(int)MathMax(1,(received+chunk_size-1)/chunk_size);
   for(int chunk=0; chunk<chunk_count; chunk++)
     {
      int start=chunk*chunk_size;
      int end=(int)MathMin(received,start+chunk_size);
      if(!PostValuesChunk("delta","",values,start,end,chunk,chunk_count,candidate,now))
        {
         g_change_id=previous_change_id;
         return false;
        }
     }
   g_change_id=candidate;
   PrintFormat("Fyodor calendar: published %d changed values",received);
   return true;
  }

int OnInit()
  {
   if(SnapshotDaysBack<0 || SnapshotDaysAhead<0 || SnapshotDaysBack+SnapshotDaysAhead<1 ||
      PollSeconds<1 || HeartbeatSeconds<1 || RetrySeconds<1 || BackfillPollSeconds<1 || EventsPerChunk<1 || EventsPerChunk>250 || StringLen(StorageUrl)==0)
     {
      Print("Fyodor calendar: invalid timer or chunk input");
      return INIT_PARAMETERS_INCORRECT;
     }
   g_instance_id=StringFormat("%I64d",AccountInfoInteger(ACCOUNT_LOGIN))+"-"+
                 StringFormat("%I64d",ChartID())+"-"+IntegerToString((long)TimeLocal());
   if(!EventSetTimer(PollSeconds))
     {
      PrintFormat("Fyodor calendar: EventSetTimer failed: %d",GetLastError());
      return INIT_FAILED;
     }
   Print("Fyodor calendar publisher v2.0.2 initialized. Live bridge protocol v1 is unchanged; storage runs separately.");
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   PrintFormat("Fyodor calendar publisher stopped: reason %d",reason);
  }

void OnTimer()
  {
   datetime now=TimeLocal();

   if(now-g_last_heartbeat_attempt>=HeartbeatSeconds)
     {
      g_last_heartbeat_attempt=now;
      PostHeartbeat();
     }

   if(!g_change_id_ready)
     {
      if(now-g_last_snapshot_attempt<RetrySeconds) return;
      g_last_snapshot_attempt=now;
      InitializeChangeId();
      return;
     }

   if(!g_snapshot_ready)
     {
      if(now-g_last_snapshot_attempt<RetrySeconds) return;
      g_last_snapshot_attempt=now;
      if(PublishSnapshot()) g_snapshot_ready=true;
      return;
     }

   if(PublishChanges()) BackfillStep();
  }


#include "FyodorCalendarStorageV2.mqh"
