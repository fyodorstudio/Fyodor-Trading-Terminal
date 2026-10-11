int LoadEventsForCurrency(const string currency,MqlCalendarEvent &events[],int &last_error)
  {
   const int attempts=(int)MathMax(1,RequestRetries);
   for(int attempt=1;attempt<=attempts;attempt++)
     {
      ResetLastError();
      const int count=CalendarEventByCurrency(currency,events);
      last_error=GetLastError();
      if(count>=0)
         return count;
      PrintFormat("CalendarEventByCurrency(%s) failed: attempt %d/%d, error %d",
                  currency,attempt,attempts,last_error);
      if(attempt<attempts)
         Sleep((uint)MathMax(0,RetryDelayMilliseconds));
     }
   return -1;
  }

int LoadValuesForEvent(const ulong event_id,MqlCalendarValue &values[],int &last_error)
  {
   const int attempts=(int)MathMax(1,RequestRetries);
   for(int attempt=1;attempt<=attempts;attempt++)
     {
      ResetLastError();
      const int count=CalendarValueHistoryByEvent(event_id,values,CalendarFromDate,g_calendar_to);
      last_error=GetLastError();
      if(count>=0)
         return count;
      PrintFormat("CalendarValueHistoryByEvent(%s) failed: attempt %d/%d, error %d",
                  ULongString(event_id),attempt,attempts,last_error);
      if(attempt<attempts)
         Sleep((uint)MathMax(0,RetryDelayMilliseconds));
     }
   return -1;
  }

//+------------------------------------------------------------------+
//| Write one immutable event-definition row                         |
//+------------------------------------------------------------------+
void WriteEventRow(const int handle,
                   const string requested_currency,
                   const MqlCalendarEvent &event,
                   const MqlCalendarCountry &country,
                   const bool country_ok)
  {
   FileWrite(handle,
      ULongString(event.id),
      CsvText(requested_currency),
      ULongString(event.country_id),
      CsvText(country_ok ? country.code : ""),
      CsvText(country_ok ? country.name : ""),
      CsvText(country_ok ? country.currency : ""),
      CsvText(country_ok ? country.currency_symbol : ""),
      CsvText(country_ok ? country.url_name : ""),
      CsvText(event.name),
      CsvText(event.event_code),
      EnumToString(event.type),
      IntegerToString((int)event.type),
      EnumToString(event.sector),
      IntegerToString((int)event.sector),
      EnumToString(event.frequency),
      IntegerToString((int)event.frequency),
      EnumToString(event.time_mode),
      IntegerToString((int)event.time_mode),
      EnumToString(event.unit),
      IntegerToString((int)event.unit),
      ImportanceLabel(event.importance),
      EnumToString(event.importance),
      IntegerToString((int)event.importance),
      EnumToString(event.multiplier),
      IntegerToString((int)event.multiplier),
      IntegerToString((int)event.digits),
      CsvText(event.source_url),
      BoolString(country_ok)
   );
  }

//+------------------------------------------------------------------+
//| Write one release row. First 11 columns remain v2-compatible.   |
//+------------------------------------------------------------------+
void WriteReleaseRow(const int handle,
                     const string requested_currency,
                     const MqlCalendarEvent &event,
                     const MqlCalendarCountry &country,
                     const bool country_ok,
                     const MqlCalendarValue &value)
  {
   FileWrite(handle,
      ULongString(event.id),
      ULongString(value.id),
      Int64String((long)value.time),
      CsvText(requested_currency),
      CsvText(country_ok ? country.code : ""),
      CsvText(event.name),
      ImportanceLabel(event.importance),
      AdjustedCalendarValue(value.actual_value,event.digits),
      AdjustedCalendarValue(value.forecast_value,event.digits),
      AdjustedCalendarValue(value.prev_value,event.digits),
      AdjustedCalendarValue(value.revised_prev_value,event.digits),
      value.period>0 ? Int64String((long)value.period) : "",
      IntegerToString(value.revision),
      EnumToString(value.impact_type),
      IntegerToString((int)value.impact_type),
      ULongString(value.event_id),
      ULongString(event.country_id),
      CsvText(event.event_code),
      EnumToString(event.type),
      EnumToString(event.sector),
      EnumToString(event.frequency),
      EnumToString(event.time_mode),
      EnumToString(event.unit),
      EnumToString(event.multiplier),
      IntegerToString((int)event.digits),
      EnumToString(event.importance),
      IntegerToString((int)event.importance),
      CsvText(event.source_url),
      RawCalendarInteger(value.actual_value),
      RawCalendarInteger(value.forecast_value),
      RawCalendarInteger(value.prev_value),
      RawCalendarInteger(value.revised_prev_value),
      ServerTimeText(value.time),
      ServerTimeText(value.period),
      "trade_server_time",
      BoolString(country_ok)
   );
  }

//+------------------------------------------------------------------+
//| Economic calendar export                                        |
//+------------------------------------------------------------------+
