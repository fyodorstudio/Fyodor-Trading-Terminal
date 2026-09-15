/** Trading-release display names, not research/model IDs or contract revisions.
 * The current frozen registry is the v1 baseline. A successor must introduce an
 * explicit registration-to-release mapping rather than relabel old records.
 */
export const FMS_BASELINE_DISPLAY_VERSION = "FMS v1";

export const FMS_BASELINE_GENERATION_SUMMARY =
  "Frozen event–pair recipes researched on historical MT5 calendar values and candles. " +
  "Each recipe declares its release package, scoring and currency orientation, " +
  "follow/rejection treatment, entry, SL, TP and expiry. Matching releases produce " +
  "setups under those rules; missing or nonmatching inputs can produce no trade. " +
  "Historical evidence is gross, not guaranteed future performance. Expand a row for its exact recipe.";
