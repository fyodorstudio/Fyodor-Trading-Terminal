import { useState } from 'react'
import type { NewsSettings } from './model'
import { enableNewsSound, playNewsSound } from './sound'
import { KeywordTags } from './KeywordTags'
import { keywordTags, starterKeywords, keywordLimit, keywordCharacters } from './keywords'

export function NewsGlobalSettings({ settings, onChange }: { settings: NewsSettings; onChange: (settings: NewsSettings) => void }) {
  const [audioError, setAudioError] = useState(''), [keywordError, setKeywordError] = useState('')
  return <div className="news-configuration-body"><section aria-label="Global news settings">
    <fieldset><legend>Sound alerts · all selected providers</legend>
      <label>Sound trigger<select aria-label="News sound trigger" value={settings.soundEnabled ? settings.soundMode : 'off'} onChange={event => {
        const mode = event.target.value
        onChange({ ...settings, soundEnabled: mode !== 'off', soundMode: mode === 'all' ? 'all' : 'included' })
        if (mode !== 'off') void enableNewsSound().then(ok => setAudioError(ok ? '' : 'Audio unavailable. Try Preview.'))
      }}><option value="off">Off</option><option value="included">Included keywords</option><option value="all">All new headlines</option></select></label>
      <label>Sound<select aria-label="News alert sound" value={settings.sound} onChange={event => onChange({ ...settings, sound: event.target.value as NewsSettings['sound'] })}>
        <option value="chime">Chime</option><option value="bell">Bell</option><option value="pulse">Pulse</option>
      </select></label>
      <button type="button" aria-label="Preview news sound" onClick={() => void enableNewsSound().then(ok => setAudioError(ok && playNewsSound(settings.sound) ? '' : 'Audio unavailable in this browser.'))}>Preview</button>
      <p>One global setting for the providers selected in News Flow. Included keywords respects Include/Exclude; All new headlines ignores keyword rules. One sound per arriving batch, even with the panel closed.</p>
      <p>Startup, historical imports and repeat headlines stay silent. Missing or scheduled publication times use first collection; collection does not prove when an article was published.</p>
      {audioError && <p role="alert">{audioError}</p>}
    </fieldset>
    <fieldset><legend>Headline colours · all providers</legend>
      <label>Included<input type="color" aria-label="Included headline colour" value={settings.includedColor} onChange={event => onChange({ ...settings, includedColor: event.target.value })} /></label>
      <label>Excluded<input type="color" aria-label="Excluded headline colour" value={settings.excludedColor} onChange={event => onChange({ ...settings, excludedColor: event.target.value })} /></label>
      <p>Colours classify relevance. They do not indicate buy/sell direction. Unmatched headlines are Excluded.</p>
    </fieldset>
  </section><section><fieldset><legend>Keywords · all providers</legend>
    <KeywordTags label="Include" value={settings.include} onChange={include => onChange({ ...settings, include })} />
    <KeywordTags label="Exclude" value={settings.exclude} onChange={exclude => onChange({ ...settings, exclude })} />
    <p>Any Include matches; any Exclude wins. Neither matching means Excluded. Case-insensitive words and phrases; AI/Fed match whole words. Japan also matches Japanese; Democrat matches Democrats/Democratic. Currency pairs such as EURUSD also match USD/EUR.</p>
    <button type="button" onClick={() => {
      const tags = keywordTags([settings.include, ...starterKeywords].join(',')), include = tags.join(', ')
      if (tags.length > keywordLimit || include.length > keywordCharacters) setKeywordError(`The combined preset would exceed ${keywordLimit} tags or ${keywordCharacters} characters. Remove some tags first.`)
      else { setKeywordError(''); onChange({ ...settings, include }) }
    }}>Add market keyword preset</button>
    {keywordError && <p role="alert">{keywordError}</p>}
    <p>Preset covers currencies, policy, economic releases, bonds, energy, geopolitics, equities/AI, metals and positioning. Exclude stays empty unless you add terms.</p>
  </fieldset></section></div>
}
