import { useRaycasterFamilies, toggleRaycasterFamily } from '../../raycaster/storage/raycaster-family-settings'
import { useRelativePreferences, toggleEurFamily } from '../../pair-context/storage/relative-preferences'
import { contextPriority, contextScorers } from '../../usd-context/core/policy'
import { eurPolicies } from '../../inspector/scoring/PAIR/EURUSD/EUR/policy/eur-policies'
import { ScoringInputSettings } from '../../inspector/scoring/shared/ui/ScoringInputSettings'

export function RaycasterSettings({ supported, relativeSupported }: { supported: boolean; relativeSupported: boolean }) {
  const families = useRaycasterFamilies(), relative = useRelativePreferences()
  return <div className="tool-settings-sections" aria-label="Raycaster configuration">
    <section><h3>USD inputs</h3>
      <ScoringInputSettings currency="USD" inputs={contextPriority.map(family => ({
        id: family, label: contextScorers[family], enabled: families.includes(family), onToggle: () => toggleRaycasterFamily(family),
      }))} />
      <p>Inputs are shared with Candy and publication scoring. Inspector’s marker filters do not affect this tool.</p>
      {!supported && <p>Select a supported USD pair to use Raycaster.</p>}
    </section>
    {relativeSupported && <section><h3>EUR inputs</h3>
      <ScoringInputSettings currency="EUR" inputs={eurPolicies.map(policy => ({
        id: policy.family, label: policy.label, enabled: relative.families.includes(policy.family), onToggle: () => toggleEurFamily(policy.family),
      }))} />
      <p>Used when the shared context view is EUR vs USD.</p>
    </section>}
    <p>Read contributions, vote age and release activity in Raycaster’s Context-detailed view.</p>
  </div>
}
