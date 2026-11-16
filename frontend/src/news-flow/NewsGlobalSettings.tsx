import { useState } from 'react'
import type { NewsSettings } from './model'
import { NewsAlarmControls, PhoneNewsSettings } from './NewsAlarm'
import { KeywordTags } from './KeywordTags'
import { keywordTags, starterKeywords, keywordLimit, keywordCharacters } from './keywords'

export function NewsGlobalSettings({ settings, onChange }: { settings: NewsSettings; onChange: (settings: NewsSettings) => void }) {
  const [keywordError, setKeywordError] = useState('')
  return <div className="news-configuration-body"><section aria-label="Global news settings">
    <NewsAlarmControls settings={settings} onChange={onChange} />
    <PhoneNewsSettings settings={settings} />
    <fieldset><legend>Headline colours · all providers</legend>
      <label>Relevant (Priority + Included)<input type="color" aria-label="Included headline colour" value={settings.includedColor} onChange={event => onChange({ ...settings, includedColor: event.target.value })} /></label>
      <label>Excluded<input type="color" aria-label="Excluded headline colour" value={settings.excludedColor} onChange={event => onChange({ ...settings, excludedColor: event.target.value })} /></label>
      <p>Colours classify relevance. They do not indicate buy/sell direction. Headlines without relevant context are Excluded.</p>
    </fieldset>
  </section><section><fieldset><legend>Keywords · all providers</legend>
    <label className="news-checkbox"><input type="checkbox" aria-label="Trading relevance" checked={settings.marketRelevance} onChange={event => onChange({ ...settings, marketRelevance: event.target.checked })} />Trading relevance: eight currencies, Brent, gold/silver and stock indices</label>
    <p>Priority highlights explicit developments and your stars. Included is other relevant news with unknown importance. Excluded is irrelevant. Alerts set to Included headlines cover both relevant levels.</p>
    <KeywordTags label="Include" value={settings.include} onChange={include => onChange({ ...settings, include })} />
    <KeywordTags label="Exclude" value={settings.exclude} onChange={exclude => onChange({ ...settings, exclude })} />
    <p>Broad tags need market context. Verified official policy and economic releases remain eligible without keywords. Routine personnel, promotions, crypto-only stories and local retail quotes are filtered with cross-market exceptions.</p>
    <p>Explicit Exclude always wins, including over stars. Uncheck Trading relevance for literal matching. All keeps everything inspectable. Priority is an attention candidate, not a prediction of volatility or direction.</p>
    <button type="button" onClick={() => {
      const tags = keywordTags([settings.include, ...starterKeywords].join(',')), include = tags.join(', ')
      if (tags.length > keywordLimit || include.length > keywordCharacters) setKeywordError(`The combined preset would exceed ${keywordLimit} tags or ${keywordCharacters} characters. Remove some tags first.`)
      else { setKeywordError(''); onChange({ ...settings, include }) }
    }}>Add market keyword preset</button>
    {keywordError && <p role="alert">{keywordError}</p>}
    <p>Preset covers currencies, policy, economic releases, funding, energy, geopolitical transmission, index companies and metals. Exclude stays empty unless you add terms; avoid broad country or scandal exclusions that can hide spillovers.</p>
  </fieldset></section></div>
}
