import { useState } from 'react'
import type { NewsSettings } from './model'
import { NewsAlarmControls, PhoneNewsSettings } from './NewsAlarm'
import { KeywordTags } from './KeywordTags'
import { keywordTags, starterKeywords, keywordLimit, keywordCharacters } from './keywords'
import { keywordGroups } from './filter-policy'
import { NewsAutomaticFilters } from './NewsAutomaticFilters'

export function NewsGlobalSettings({ settings, onChange }: { settings: NewsSettings; onChange: (settings: NewsSettings) => void }) {
  const [keywordError, setKeywordError] = useState('')
  return <div className="news-configuration-body"><section aria-label="Global news settings">
    <NewsAlarmControls settings={settings} onChange={onChange} />
    <PhoneNewsSettings />
    <fieldset><legend>Headline colours · all providers</legend>
      <label>Priority 1 + Priority 2<input type="color" aria-label="Priority headline colour" value={settings.includedColor} onChange={event => onChange({ ...settings, includedColor: event.target.value })} /></label>
      <label>Excluded<input type="color" aria-label="Excluded headline colour" value={settings.excludedColor} onChange={event => onChange({ ...settings, excludedColor: event.target.value })} /></label>
      <p>Colours classify relevance. They do not indicate buy/sell direction. Headlines without relevant context are Excluded.</p>
    </fieldset>
  </section><section><fieldset><legend>Keywords · all providers</legend>
    <label className="news-checkbox"><input type="checkbox" aria-label="Trading relevance" checked={settings.marketRelevance} onChange={event => onChange({ ...settings, marketRelevance: event.target.checked })} />Trading relevance: eight currencies, Brent, gold/silver and stock indices</label>
    <p>Priority 1 includes important catalysts, risk sentiment, capital flows and fundamental repricing, including relevant research and scenarios. Priority 2 contains other relevant context. Excluded contains noise rejected by your filters. Use the reading checkboxes to combine tiers; the alert trigger selects Priority 1 only or both tiers.</p>
    <KeywordTags label="Include" value={settings.include} groups={keywordGroups} onChange={include => onChange({ ...settings, include })} />
    <KeywordTags label="Exclude" value={settings.exclude} onChange={exclude => onChange({ ...settings, exclude })} />
    <p>Broad tags need market context. Verified official policy and economic releases remain eligible without keywords. Routine personnel, promotions, crypto-only stories and local retail quotes are filtered with cross-market exceptions.</p>
    <p>A broad Include list also keeps relevant market mechanisms without a matching tag. Explicit Exclude always wins, including over stars. Uncheck Trading relevance for literal matching. All keeps everything inspectable. Priority 1 is an attention flag, not a prediction of price direction.</p>
    <button type="button" onClick={() => {
      const tags = keywordTags([settings.include, ...starterKeywords].join(',')), include = tags.join(', ')
      if (tags.length > keywordLimit || include.length > keywordCharacters) setKeywordError(`The combined preset would exceed ${keywordLimit} tags or ${keywordCharacters} characters. Remove some tags first.`)
      else { setKeywordError(''); onChange({ ...settings, include }) }
    }}>Add market keyword preset</button>
    {keywordError && <p role="alert">{keywordError}</p>}
    <p>Preset covers currencies, policy, economic releases, funding, energy, geopolitical transmission, index companies and metals. Exclude stays empty unless you add terms; avoid broad country or scandal exclusions that can hide spillovers.</p>
  </fieldset><NewsAutomaticFilters settings={settings} onChange={onChange} /></section></div>
}
