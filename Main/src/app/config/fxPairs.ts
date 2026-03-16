import type { FxPairDefinition } from "@/app/types";

export const MAJOR_CURRENCY_ORDER = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "NZD", "CHF"] as const;

export const CURRENCY_TO_COUNTRY_CODE: Record<(typeof MAJOR_CURRENCY_ORDER)[number], string> = {
  USD: "US",
  EUR: "EU",
  GBP: "GB",
  JPY: "JP",
  AUD: "AU",
  CAD: "CA",
  NZD: "NZ",
  CHF: "CH",
};

export const FX_PAIRS: FxPairDefinition[] = [
  { base: "EUR", quote: "USD", name: "EURUSD" },
  { base: "USD", quote: "JPY", name: "USDJPY" },
  { base: "GBP", quote: "USD", name: "GBPUSD" },
  { base: "USD", quote: "CHF", name: "USDCHF" },
  { base: "AUD", quote: "USD", name: "AUDUSD" },
  { base: "USD", quote: "CAD", name: "USDCAD" },
  { base: "NZD", quote: "USD", name: "NZDUSD" },
  { base: "EUR", quote: "GBP", name: "EURGBP" },
  { base: "EUR", quote: "JPY", name: "EURJPY" },
  { base: "EUR", quote: "CHF", name: "EURCHF" },
  { base: "EUR", quote: "AUD", name: "EURAUD" },
  { base: "EUR", quote: "CAD", name: "EURCAD" },
  { base: "EUR", quote: "NZD", name: "EURNZD" },
  { base: "GBP", quote: "JPY", name: "GBPJPY" },
  { base: "GBP", quote: "CHF", name: "GBPCHF" },
  { base: "GBP", quote: "AUD", name: "GBPAUD" },
  { base: "GBP", quote: "CAD", name: "GBPCAD" },
  { base: "GBP", quote: "NZD", name: "GBPNZD" },
  { base: "CHF", quote: "JPY", name: "CHFJPY" },
  { base: "AUD", quote: "CHF", name: "AUDCHF" },
  { base: "CAD", quote: "CHF", name: "CADCHF" },
  { base: "NZD", quote: "CHF", name: "NZDCHF" },
  { base: "AUD", quote: "JPY", name: "AUDJPY" },
  { base: "AUD", quote: "CAD", name: "AUDCAD" },
  { base: "AUD", quote: "NZD", name: "AUDNZD" },
  { base: "CAD", quote: "JPY", name: "CADJPY" },
  { base: "CAD", quote: "NZD", name: "CADNZD" },
  { base: "NZD", quote: "JPY", name: "NZDJPY" },
];

export function getFxPairByName(name: string): FxPairDefinition | null {
  return FX_PAIRS.find((pair) => pair.name === name) ?? null;
}
