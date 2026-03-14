import {
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  subWeeks,
} from "date-fns";
import type { DatePreset, DateRange } from "@/app/types";

export function getPresetRange(preset: DatePreset, now: Date, customRange: DateRange): DateRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return { from: today, to: endOfDay(today) };
    case "this_week":
      return { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) };
    case "next_week": {
      const start = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1);
      return { from: start, to: endOfWeek(start, { weekStartsOn: 1 }) };
    }
    case "last_week": {
      const start = subWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1);
      return { from: start, to: endOfWeek(start, { weekStartsOn: 1 }) };
    }
    case "this_month":
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case "before_today": {
      const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
      return { from: new Date(1970, 0, 1), to: endOfDay(yesterday) };
    }
    case "custom":
    default:
      return {
        from: customRange.from,
        to: customRange.to ? endOfDay(customRange.to) : customRange.to,
      };
  }
}
