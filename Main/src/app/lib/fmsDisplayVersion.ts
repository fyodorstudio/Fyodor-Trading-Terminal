/** Trading-release display names, not research/model IDs or contract revisions.
 * The current frozen registry is the v1 baseline. A successor must introduce an
 * explicit registration-to-release mapping rather than relabel old records.
 */
export const FMS_BASELINE_DISPLAY_VERSION = "FMS v1";
export const FMS_SUCCESSOR_DISPLAY_VERSION = "FMS v2";
export type FmsDisplayVersion = typeof FMS_BASELINE_DISPLAY_VERSION | typeof FMS_SUCCESSOR_DISPLAY_VERSION;

export const FMS_BASELINE_GENERATION_SUMMARY =
  "Frozen event–pair recipes researched on historical MT5 calendar values and candles. " +
  "Each recipe declares its release package, scoring and currency orientation, " +
  "follow/rejection treatment, entry, SL, TP and expiry. Matching releases produce " +
  "setups under those rules; missing or nonmatching inputs can produce no trade. " +
  "Historical evidence is gross, not guaranteed future performance. Expand a row for its exact recipe.";

export const FMS_SUCCESSOR_GENERATION_SUMMARY =
  "Approved event-specific execution successors retain each recipe's v1 release/scoring rule, " +
  "but use a separately selected SL, TP and expiry after the v2 activation boundary. " +
  "Selection used development history; the reused chronological holdout had to remain positive " +
  "and improve over the exact v1 contract on the same complete H4 paths. Old arrows stay v1.";
