// Storage transport is separate from the frozen bridge protocol. One history
// query OR one chunk runs per timer tick, after live work. Companion to v2.0.2.
MqlCalendarEvent g_event_cache[];
MqlCalendarCountry g_country_cache[];
MqlCalendarValue g_backfill_values[];
string g_backfill_job="";
string g_backfill_token="";
string g_backfill_currency="";
datetime g_backfill_from=0;
datetime g_backfill_to=0;
bool g_backfill_loaded=false;
int g_backfill_chunk=0;
int g_backfill_error=0;
datetime g_backfill_retry_at=0;
datetime g_last_job_poll=0;
datetime g_last_storage_register=0;
int g_storage_status=0;

bool CachedEvent(const ulong id,MqlCalendarEvent &event)
  {
   for(int i=0;i<ArraySize(g_event_cache);i++)
      if(g_event_cache[i].id==id) { event=g_event_cache[i]; return true; }
   if(!CalendarEventById(id,event)) return false;
   int size=ArraySize(g_event_cache);
   if(ArrayResize(g_event_cache,size+1)!=size+1) return false;
   g_event_cache[size]=event;
   return true;
  }

bool CachedCountry(const ulong id,MqlCalendarCountry &country)
  {
   for(int i=0;i<ArraySize(g_country_cache);i++)
      if(g_country_cache[i].id==id) { country=g_country_cache[i]; return true; }
   if(!CalendarCountryById(id,country)) return false;
   int size=ArraySize(g_country_cache);
   if(ArrayResize(g_country_cache,size+1)!=size+1) return false;
   g_country_cache[size]=country;
   return true;
  }

string RawNumber(const bool available,const long value)
  {
   return available ? JsonString(IntegerToString(value)) : "null";
  }

string RawValuesJson(const MqlCalendarValue &value)
  {
   return ",\"actual_raw_scaled_1e6\":"+RawNumber(value.HasActualValue(),value.actual_value)+
          ",\"forecast_raw_scaled_1e6\":"+RawNumber(value.HasForecastValue(),value.forecast_value)+
          ",\"previous_raw_scaled_1e6\":"+RawNumber(value.HasPreviousValue(),value.prev_value)+
          ",\"revised_previous_raw_scaled_1e6\":"+RawNumber(value.HasRevisedValue(),value.revised_prev_value);
  }

string PublisherContextJson()
  {
   return "{\"protocol_version\":1,\"publisher_version\":\"2.0.2\",\"source_id\":"+
          JsonString(AccountInfoString(ACCOUNT_SERVER))+",\"instance_id\":"+JsonString(g_instance_id)+
          ",\"server_time_seconds\":"+IntegerToString((long)TimeTradeServer())+
          ",\"server_utc_offset_seconds\":"+IntegerToString(ServerUtcOffsetSeconds())+"}";
  }

bool StorageRequest(const string path,const string payload,string &body)
  {
   char request[],response[];
   string response_headers;
   int copied=StringToCharArray(payload,request,0,WHOLE_ARRAY,CP_UTF8);
   if(copied>0) ArrayResize(request,copied-1);
   ResetLastError();
   g_storage_status=WebRequest("POST",StorageUrl+path,"Content-Type: application/json\r\n",
                              RequestTimeoutMilliseconds,request,response,response_headers);
   body=CharArrayToString(response,0,-1,CP_UTF8);
   if(g_storage_status==200) return true;
   PrintFormat("Fyodor storage: %s HTTP %d, MQL error %d: %s",
               path,g_storage_status,GetLastError(),body);
   return false;
  }

// Narrow parser for the service's flat response contract. Values used here
// are booleans, integer timestamps, EUR/USD and hexadecimal UUIDs.
int JsonValueStart(const string json,const string key)
  {
   int start=StringFind(json,JsonString(key));
   if(start<0) return -1;
   start+=StringLen(key)+2;
   while(start<StringLen(json) && StringGetCharacter(json,start)<=32) start++;
   if(start>=StringLen(json) || StringGetCharacter(json,start)!=58) return -1;
   start++;
   while(start<StringLen(json) && StringGetCharacter(json,start)<=32) start++;
   return start;
  }

bool JsonText(const string json,const string key,string &value)
  {
   int start=JsonValueStart(json,key);
   if(start<0 || StringGetCharacter(json,start)!=34) return false;
   int end=StringFind(json,"\"",start+1);
   if(end<0) return false;
   value=StringSubstr(json,start+1,end-start-1);
   return StringFind(value,"\\")<0;
  }

bool JsonInteger(const string json,const string key,long &value)
  {
   int start=JsonValueStart(json,key);
   if(start<0) return false;
   int end=start;
   while(end<StringLen(json) && StringGetCharacter(json,end)>=48 && StringGetCharacter(json,end)<=57) end++;
   if(end==start || end-start>12) return false;
   value=StringToInteger(StringSubstr(json,start,end-start));
   return true;
  }

bool JsonBoolean(const string json,const string key,bool &value)
  {
   int start=JsonValueStart(json,key);
   if(start<0) return false;
   if(StringSubstr(json,start,4)=="true") { value=true; return true; }
   if(StringSubstr(json,start,5)=="false") { value=false; return true; }
   return false;
  }

bool IsHexId(const string value)
  {
   if(StringLen(value)!=32) return false;
   for(int i=0;i<32;i++)
     {
      ushort c=StringGetCharacter(value,i);
      if(!((c>=48 && c<=57) || (c>=97 && c<=102))) return false;
     }
   return true;
  }

void ResetBackfill()
  {
   g_backfill_job="";
   g_backfill_token="";
   g_backfill_loaded=false;
   g_backfill_error=0;
   g_backfill_chunk=0;
   ArrayFree(g_backfill_values);
  }

void BackfillStep()
  {
   if(!TerminalInfoInteger(TERMINAL_CONNECTED)) return;
   datetime now=TimeLocal();
   if(now<g_backfill_retry_at) return;
   string body;
   if(now-g_last_storage_register>=HeartbeatSeconds)
     {
      g_last_storage_register=now;
      if(!StorageRequest("/publisher",PublisherContextJson(),body))
        { g_backfill_retry_at=now+RetrySeconds; return; }
     }
   if(!EnableAutomaticBackfill) return;
   if(g_backfill_job=="")
     {
      if(now-g_last_job_poll<BackfillPollSeconds) return;
      g_last_job_poll=now;
      if(!StorageRequest("/jobs/next",PublisherContextJson(),body))
        { g_backfill_retry_at=now+RetrySeconds; return; }
      bool available=false;
      if(!JsonBoolean(body,"available",available)) return;
      if(!available) return;
      string job,token,currency;
      long from_seconds,to_seconds;
      if(!JsonText(body,"job_id",job) || !JsonText(body,"lease_token",token) ||
         !JsonText(body,"currency",currency) || !JsonInteger(body,"from_server_seconds",from_seconds) ||
         !JsonInteger(body,"to_server_seconds",to_seconds) || !IsHexId(job) || !IsHexId(token) ||
         (currency!="EUR" && currency!="USD") || from_seconds<1420070400 || to_seconds<=from_seconds)
        { Print("Fyodor storage: malformed backfill job rejected."); return; }
      g_backfill_job=job; g_backfill_token=token; g_backfill_currency=currency;
      g_backfill_from=(datetime)from_seconds; g_backfill_to=(datetime)to_seconds;
      return;
     }
   if(g_backfill_error!=0)
     {
      string failure="{\"protocol_version\":1,\"job_id\":"+JsonString(g_backfill_job)+
                     ",\"lease_token\":"+JsonString(g_backfill_token)+
                     ",\"error_code\":"+IntegerToString(g_backfill_error)+"}";
      if(StorageRequest("/jobs/fail",failure,body) || g_storage_status==409) ResetBackfill();
      g_backfill_retry_at=now+RetrySeconds;
      return;
     }
   if(!g_backfill_loaded)
     {
      ResetLastError();
      // MT5 can include an all-day holiday before an intraday left boundary.
      // Request a complete-day superset, then select the exact job interval.
      datetime query_from=(datetime)(((long)g_backfill_from/86400)*86400);
      datetime query_to=(datetime)((((long)g_backfill_to+86399)/86400)*86400);
      int received=CalendarValueHistory(g_backfill_values,query_from,query_to-1,"",g_backfill_currency);
      int error=GetLastError();
      if(received<0 || error!=0)
        {
         g_backfill_error=(error!=0 ? error : 4001);
         PrintFormat("Fyodor backfill: query failed for %s (%d); coverage stays pending.",g_backfill_currency,g_backfill_error);
         return;
        }
      int selected=0;
      for(int i=0;i<received;i++)
        {
         if(g_backfill_values[i].time<query_from || g_backfill_values[i].time>=query_to)
           {
            PrintFormat("Fyodor backfill: out-of-range value %s event %s at %s; %s job %s expects [%s, %s). No coverage committed.",
                        ULongString(g_backfill_values[i].id),ULongString(g_backfill_values[i].event_id),
                        TimeToString(g_backfill_values[i].time,TIME_DATE|TIME_SECONDS),g_backfill_currency,g_backfill_job,
                        TimeToString(g_backfill_from,TIME_DATE|TIME_SECONDS),TimeToString(g_backfill_to,TIME_DATE|TIME_SECONDS));
            g_backfill_error=-1001; return;
           }
         if(g_backfill_values[i].time<g_backfill_from || g_backfill_values[i].time>=g_backfill_to) continue;
         if(selected!=i) g_backfill_values[selected]=g_backfill_values[i];
         selected++;
        }
      if(selected!=received)
         PrintFormat("Fyodor backfill: selected %d of %d values for the exact %s interval; other values belong to boundary-day padding.",selected,received,g_backfill_currency);
      // Only serialize the count returned by this query, never unused capacity.
      if(ArrayResize(g_backfill_values,selected)!=selected)
        { g_backfill_error=4004; return; }
      g_backfill_loaded=true;
      g_backfill_chunk=0;
      return;
     }
   int count=ArraySize(g_backfill_values);
   int chunks=(int)MathMax(1,(count+EventsPerChunk-1)/EventsPerChunk);
   int start=g_backfill_chunk*EventsPerChunk;
   int end=(int)MathMin(count,start+EventsPerChunk);
   string json="{\"protocol_version\":1,\"job_id\":"+JsonString(g_backfill_job)+
               ",\"lease_token\":"+JsonString(g_backfill_token)+
               ",\"chunk_index\":"+IntegerToString(g_backfill_chunk)+
               ",\"chunk_count\":"+IntegerToString(chunks)+",\"event_count\":"+IntegerToString(count)+",\"events\":[";
   for(int i=start;i<end;i++)
     {
      string event_json;
      if(!CalendarValueJson(g_backfill_values[i],event_json,true))
        { PrintFormat("Fyodor backfill: metadata failed for value %s in job %s.",ULongString(g_backfill_values[i].id),g_backfill_job);
          g_backfill_error=-1002; return; } // Never silently skip a row.
      if(i>start) json+=",";
      json+=event_json;
     }
   json+="]}";
   if(!StorageRequest("/jobs/chunk",json,body))
     {
      // Network failures retry the SAME chunk, including a lost commit reply.
      if(g_storage_status==409) g_backfill_error=4001;
      g_backfill_retry_at=now+RetrySeconds;
      return;
     }
   bool accepted=false,committed=false;
   if(!JsonBoolean(body,"accepted",accepted) || !accepted || !JsonBoolean(body,"committed",committed))
     { g_backfill_retry_at=now+RetrySeconds; return; }
   g_backfill_chunk++;
   if(g_backfill_chunk==chunks)
     {
      if(!committed) { g_backfill_error=4001; return; }
      PrintFormat("Fyodor backfill: committed %s %s to %s, %d values.",
                  g_backfill_currency,TimeToString(g_backfill_from),TimeToString(g_backfill_to),count);
      ResetBackfill();
     }
  }
