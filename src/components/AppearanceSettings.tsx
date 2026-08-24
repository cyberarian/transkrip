import { useState } from 'react'
import { APPEARANCE_PRESETS, getAppearance, saveAppearance, type AppearanceId } from '../appearance'

export function AppearanceSettings() {
  const [selected, setSelected] = useState(() => getAppearance())
  const [notice, setNotice] = useState('Pilihan berlaku di seluruh aplikasi dan tersimpan di browser ini.')

  const select = (appearance: AppearanceId) => {
    try {
      saveAppearance(appearance)
      setSelected(appearance)
      const preset = APPEARANCE_PRESETS.find(candidate => candidate.id === appearance)
      setNotice(`${preset?.name ?? appearance} aktif dan tersimpan di perangkat ini.`)
    } catch {
      setNotice('Pilihan tampilan tidak dapat disimpan oleh browser ini.')
    }
  }

  return <section className="appearance-workbench" aria-labelledby="appearance-title">
    <header>
      <div>
        <h2 id="appearance-title">Tampilan &amp; tipografi</h2>
        <p id="appearance-description" role="status" aria-live="polite">{notice}</p>
      </div>
      <span className="appearance-local">Font lokal saja</span>
    </header>
    <fieldset className="appearance-ledger" aria-describedby="appearance-description">
      <legend>Pilih karakter baca</legend>
      {APPEARANCE_PRESETS.map((preset, index) => <label className={`appearance-option appearance-${preset.id}${selected === preset.id ? ' selected' : ''}`} key={preset.id}>
        <input type="radio" name="appearance" value={preset.id} checked={selected === preset.id} onChange={() => select(preset.id)}/>
        <span className="appearance-index">{String(index + 1).padStart(2, '0')}</span>
        <span className="appearance-choice" aria-hidden="true"><i/></span>
        <span className="appearance-copy"><b>{preset.name}</b><small>{preset.description}</small></span>
        <span className="appearance-sample" lang="id">{preset.sample}</span>
        <span className="appearance-state">{selected === preset.id ? 'Aktif' : 'Pilih'}</span>
      </label>)}
    </fieldset>
  </section>
}
