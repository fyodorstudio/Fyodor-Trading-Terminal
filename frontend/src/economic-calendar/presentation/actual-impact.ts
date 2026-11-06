/** MT5's reported directional assessment; never infer it from A/F/P or tiers. */
export function actualImpact(value: number | null | undefined, impact: unknown) {
  return value != null && (impact === 'positive' || impact === 'negative') ? impact : undefined
}
