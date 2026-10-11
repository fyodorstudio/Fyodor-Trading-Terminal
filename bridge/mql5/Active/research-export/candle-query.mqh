int LoadRates(const string symbol,MqlRates &rates[],int &last_error)
  {
   const int attempts=(int)MathMax(1,RequestRetries);
   MqlRates best_rates[];
   int best_count=-1;
   datetime best_first=0;
   for(int attempt=1;attempt<=attempts;attempt++)
     {
      ResetLastError();
      const int copied=CopyRates(symbol,CandleTimeframe,CandleFromDate,g_candle_to,rates);
      last_error=GetLastError();
      if(copied>0)
        {
         const datetime first=rates[0].time;
         const datetime last=rates[copied-1].time;
         if(copied>best_count || (copied==best_count && (best_first==0 || first<best_first)))
           {
            best_count=copied;
            best_first=first;
            ArrayCopy(best_rates,rates);
           }
         const datetime server_first=(datetime)SeriesInfoInteger(symbol,CandleTimeframe,SERIES_SERVER_FIRSTDATE);
         const datetime expected_first=(server_first>CandleFromDate ? server_first : CandleFromDate);
         const bool first_ready=((long)first<=(long)expected_first+7*86400);
         const bool last_ready=((long)last+(long)PeriodSeconds(CandleTimeframe)>=(long)g_candle_to-7*86400);
         const bool synchronized=(bool)SeriesInfoInteger(symbol,CandleTimeframe,SERIES_SYNCHRONIZED);
         if(first_ready && last_ready && synchronized)
            return copied;
         PrintFormat("CopyRates(%s) still loading: attempt %d/%d, count=%d, first=%s, last=%s, synchronized=%s",
                     symbol,attempt,attempts,copied,ServerTimeText(first),ServerTimeText(last),BoolString(synchronized));
        }
      else
         PrintFormat("CopyRates(%s) unavailable: attempt %d/%d, result=%d, error=%d",
                     symbol,attempt,attempts,copied,last_error);
      if(attempt<attempts)
         Sleep((uint)MathMax(0,RetryDelayMilliseconds));
     }
   if(best_count>0)
     {
      ArrayCopy(rates,best_rates);
      PrintFormat("WARNING: CopyRates(%s) did not establish both requested boundaries; exporting the best observed partial history for audit.",symbol);
      return best_count;
     }
   return -1;
  }

string TimeframeToken()
  {
   string token=EnumToString(CandleTimeframe);
   StringReplace(token,"PERIOD_","");
   return token;
  }

string CanonicalSymbolToken(const string symbol)
  {
   string base=SymbolInfoString(symbol,SYMBOL_CURRENCY_BASE);
   string profit=SymbolInfoString(symbol,SYMBOL_CURRENCY_PROFIT);
   StringToUpper(base);
   StringToUpper(profit);
   if(StringLen(base)==3 && StringLen(profit)==3)
      return SafeFileToken(base+profit);
   return SafeFileToken(symbol);
  }

string ChartPriceBasis(const string symbol)
  {
   const int mode=(int)SymbolInfoInteger(symbol,SYMBOL_CHART_MODE);
   if(mode==SYMBOL_CHART_MODE_BID)  return "bid";
   if(mode==SYMBOL_CHART_MODE_LAST) return "last";
   return "unknown";
  }

bool StringArrayContains(string &values[],const string target)
  {
   for(int i=0;i<ArraySize(values);i++)
      if(values[i]==target)
         return true;
   return false;
  }

void StringArrayAppend(string &values[],const string value)
  {
   const int size=ArraySize(values);
   ArrayResize(values,size+1);
   values[size]=value;
  }

void WriteCandleFailure(const int handle,const string symbol,const string canonical,
                        const string timeframe,const string status,const int error_code)
  {
   FileWrite(handle,
      CsvText(symbol),CsvText(canonical),"",CsvText(timeframe),
      "","","","","","",
      "0","0","","","","",
      Int64String((long)CandleFromDate),Int64String((long)g_candle_to),
      "","","0",IntegerToString(error_code),CsvText(status),""
   );
  }

//+------------------------------------------------------------------+
//| H1/selected-timeframe export                                     |
//+------------------------------------------------------------------+
