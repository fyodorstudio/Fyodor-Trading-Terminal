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
  { id: "macro-signal-lab", label: "FMS EXPERIMENT WORKBENCH", groupLabel: "Retained Research Workspace" },
  { id: "dashboard", label: "DIFFERENTIAL CALCULATOR", groupLabel: "Retained Experiment / Hidden" },
  { id: "event-tools", label: "EVENT REPLAY", groupLabel: "Garbage / Ignore" },
  { id: "macro-drivers", label: "MACRO DRIVERS", groupLabel: "Garbage / Ignore" },
  { id: "prototyping", label: "PROTOTYPING", groupLabel: "Garbage / Ignore" },
];

export const TAB_ORDER: AppTabConfig[] = [
  { id: "charts", label: "Charts" },
];
