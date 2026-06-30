import type { TabId } from "@/app/types";

export interface AppTabChild {
  id: TabId;
  label: string;
  groupLabel?: string;
}

export interface AppTabConfig {
  id: TabId;
  label: string;
  children?: AppTabChild[];
}

export const ANALYSIS_TAB_ORDER: AppTabChild[] = [
  { id: "dashboard", label: "DIFFERENTIAL CALCULATOR", groupLabel: "Active Tool" },
  { id: "event-tools", label: "EVENT REPLAY", groupLabel: "Active Experiment" },
  { id: "prototyping", label: "PROTOTYPING", groupLabel: "Garbage / Ignore" },
];

export const TAB_ORDER: AppTabConfig[] = [
  { id: "overview", label: "Overview" },
  { id: "central-banks", label: "Central Banks Data" },
  { id: "charts", label: "Charts" },
  { id: "calendar", label: "Economic Calendar" },
  { id: "dashboard", label: "Specialist Tools", children: ANALYSIS_TAB_ORDER },
];
