import type { CentralBankSnapshot } from "@/app/types/centralBanks";
import type { FxPairDefinition } from "@/app/types/fx";

export interface DashboardCurrencySnapshot {
  currency: string;
  countryCode: string;
  bankName: string;
  flag: string;
  currentPolicyRate: number | null;
  previousPolicyRate: number | null;
  currentInflationRate: number | null;
  previousInflationRate: number | null;
  sourceStatus: CentralBankSnapshot["status"];
  unresolvedFields: string[];
}

export type DashboardSortMode = "absDesc" | "absAsc" | "default";

export interface DashboardRateCard {
  pair: FxPairDefinition;
  currentGap: number | null;
  previousGap: number | null;
  trend: number | null;
  isWidening: boolean | null;
  status: "ok" | "partial" | "missing";
}

export interface DashboardInflationCard {
  pair: FxPairDefinition;
  bias: number | null;
  status: "ok" | "missing";
}
