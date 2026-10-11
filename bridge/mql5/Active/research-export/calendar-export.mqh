CalendarExportResult ExportEconomicCalendar()
  {
   CalendarExportResult result;
   ZeroMemory(result);

   const int event_handle=OpenCsv("calendar_events.csv");
   const int release_handle=OpenCsv("calendar_releases.csv");
   const int currency_handle=OpenCsv("calendar_currencies.csv");
   if(event_handle==INVALID_HANDLE || release_handle==INVALID_HANDLE || currency_handle==INVALID_HANDLE)
     {
      if(event_handle!=INVALID_HANDLE) FileClose(event_handle);
      if(release_handle!=INVALID_HANDLE) FileClose(release_handle);
      if(currency_handle!=INVALID_HANDLE) FileClose(currency_handle);
      return result;
     }

   FileWrite(currency_handle,"currency","event_definitions","releases","query_error","status");

   FileWrite(event_handle,
      "event_id","requested_currency","country_id","country_code","country_name",
      "country_currency","country_currency_symbol","country_url_name","event_name","event_code",
      "event_type","event_type_code","sector","sector_code","frequency","frequency_code",
      "time_mode","time_mode_code","unit","unit_code","importance","importance_enum",
      "importance_code","multiplier","multiplier_code","digits","source_url","country_lookup_ok"
   );

   FileWrite(release_handle,
      "event_id","value_id","timestamp","currency","country_code","event_name","importance",
      "actual","forecast","previous","revised_previous",
      "period","revision","impact_type","impact_type_code","value_event_id","country_id",
      "event_code","event_type","sector","frequency","time_mode","unit","multiplier","digits",
      "importance_enum","importance_code","source_url",
      "actual_raw_scaled_1e6","forecast_raw_scaled_1e6","previous_raw_scaled_1e6",
      "revised_previous_raw_scaled_1e6","timestamp_server_text","period_server_text",
      "timestamp_convention","country_lookup_ok"
   );

   string currencies[];
   const int currency_count=StringSplit(CalendarCurrencies,',',currencies);
   if(currency_count<=0)
     {
      Print("ERROR: CalendarCurrencies did not contain any values.");
      FileClose(event_handle);
      FileClose(release_handle);
      FileClose(currency_handle);
      return result;
     }

   bool abort_export=false;
   for(int c=0;c<currency_count && !abort_export;c++)
     {
      string currency=currencies[c];
      StringTrimLeft(currency);
      StringTrimRight(currency);
      StringToUpper(currency);
      if(currency=="")
         continue;

      MqlCalendarEvent events[];
      int last_error=0;
      const int event_count=LoadEventsForCurrency(currency,events,last_error);
      if(event_count<0)
        {
         result.event_queries_failed++;
         FileWrite(currency_handle,CsvText(currency),"0","0",IntegerToString(last_error),"event_query_failed");
         if(StopOnCalendarError)
            abort_export=true;
         continue;
        }
      if(event_count==0)
        {
         result.currencies_without_events++;
         FileWrite(currency_handle,CsvText(currency),"0","0","0","no_events");
         if(StopOnCalendarError)
            abort_export=true;
         continue;
        }

      int currency_releases=0;
      int currency_value_failures=0;
      for(int e=0;e<event_count;e++)
        {
         const MqlCalendarEvent event=events[e];
         MqlCalendarCountry country;
         ZeroMemory(country);
         ResetLastError();
         const bool country_ok=CalendarCountryById(event.country_id,country);
         if(!country_ok)
            result.countries_failed++;

         WriteEventRow(event_handle,currency,event,country,country_ok);
         result.events++;

         MqlCalendarValue values[];
         const int value_count=LoadValuesForEvent(event.id,values,last_error);
         if(value_count<0)
           {
            result.value_queries_failed++;
            currency_value_failures++;
            if(StopOnCalendarError)
              {
               abort_export=true;
               break;
              }
            continue;
           }

         for(int v=0;v<value_count;v++)
           {
            if(values[v].event_id!=event.id)
               result.event_id_mismatches++;
            WriteReleaseRow(release_handle,currency,event,country,country_ok,values[v]);
            result.releases++;
            currency_releases++;
            if((result.releases%10000)==0)
               FileFlush(release_handle);
           }
        }
      FileWrite(currency_handle,CsvText(currency),IntegerToString(event_count),
                IntegerToString(currency_releases),IntegerToString(currency_value_failures),
                currency_value_failures>0 ? "value_query_failed" : "ok");
      PrintFormat("Calendar %s: %d event definitions, %d releases",
                  currency,event_count,currency_releases);
     }

   FileFlush(event_handle);
   FileFlush(release_handle);
   FileFlush(currency_handle);
   FileClose(event_handle);
   FileClose(release_handle);
   FileClose(currency_handle);

   result.completed=(!abort_export &&
                     result.event_queries_failed==0 &&
                     result.currencies_without_events==0 &&
                     result.value_queries_failed==0 &&
                     result.countries_failed==0 &&
                     result.event_id_mismatches==0);
   return result;
  }

//+------------------------------------------------------------------+
//| Candle helpers                                                   |
//+------------------------------------------------------------------+
