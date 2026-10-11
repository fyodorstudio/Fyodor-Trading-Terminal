//+------------------------------------------------------------------+
//| Primitive formatting helpers                                    |
//+------------------------------------------------------------------+
string BoolString(const bool value)
  {
   return value ? "true" : "false";
  }

string Int64String(const long value)
  {
   return IntegerToString(value);
  }

string ULongString(const ulong value)
  {
   // Preserve the entire unsigned 64-bit identifier with no narrowing cast.
   return StringFormat("%I64u",value);
  }

string ServerTimeText(const datetime value)
  {
   if(value<=0)
      return "";
   return TimeToString(value,TIME_DATE|TIME_SECONDS);
  }

string CompactTimestamp(const datetime value)
  {
   string result=TimeToString(value,TIME_DATE|TIME_SECONDS);
   StringReplace(result,".","");
   StringReplace(result,":","");
   StringReplace(result," ","_");
   return result;
  }

string SafeFileToken(string value)
  {
   StringTrimLeft(value);
   StringTrimRight(value);
   StringReplace(value,"\\","_");
   StringReplace(value,"/","_");
   StringReplace(value,":","_");
   StringReplace(value,"*","_");
   StringReplace(value,"?","_");
   StringReplace(value,"\"","_");
   StringReplace(value,"<","_");
   StringReplace(value,">","_");
   StringReplace(value,"|","_");
   StringReplace(value," ","_");
   return value;
  }

string CsvText(string value)
  {
   // FileWrite separates parameters but does not RFC-4180-escape delimiters
   // inside strings. Always quote source text, double embedded quotes, and
   // flatten line breaks so every exported record remains exactly one line.
   StringReplace(value,"\r"," ");
   StringReplace(value,"\n"," ");
   StringReplace(value,"\"","\"\"");
   return "\""+value+"\"";
  }

int SafeDigits(const uint digits)
  {
   if(digits>16)
      return 16;
   return (int)digits;
  }

string RawCalendarInteger(const long raw)
  {
   if(raw==LONG_MIN)
      return "";
   return IntegerToString(raw);
  }

string AdjustedCalendarValue(const long raw,const uint digits)
  {
   if(raw==LONG_MIN)
      return "";
   const double adjusted=(double)raw/1000000.0;
   return DoubleToString(adjusted,SafeDigits(digits));
  }

//+------------------------------------------------------------------+
//| Exact importance mapping                                        |
//+------------------------------------------------------------------+
string ImportanceLabel(const ENUM_CALENDAR_EVENT_IMPORTANCE importance)
  {
   switch(importance)
     {
      case CALENDAR_IMPORTANCE_NONE:     return "none";
      case CALENDAR_IMPORTANCE_LOW:      return "low";
      case CALENDAR_IMPORTANCE_MODERATE: return "medium";
      case CALENDAR_IMPORTANCE_HIGH:     return "high";
     }
   return "unknown";
  }

//+------------------------------------------------------------------+
//| CSV open helper: UTF-8, comma-delimited, isolated run folder     |
//+------------------------------------------------------------------+
int OpenCsv(const string relative_path)
  {
   ResetLastError();
   const int handle=FileOpen(g_export_root+"\\"+relative_path,
                             FILE_WRITE|FILE_CSV|FILE_ANSI|g_file_flags,
                             ',',CP_UTF8);
   if(handle==INVALID_HANDLE)
      PrintFormat("ERROR: FileOpen failed for %s (error %d)",relative_path,GetLastError());
   return handle;
  }

//+------------------------------------------------------------------+
//| Calendar API retry helpers                                      |
//+------------------------------------------------------------------+
