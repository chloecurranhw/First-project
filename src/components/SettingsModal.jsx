import { useState } from 'react'

export default function SettingsModal({
  settings, defaultSettings,
  savingsDefaults, defaultSavings,
  onSave, onSaveSavingsDefaults,
  apiKey, onApiKeySave,
  onClose,
}) {
  const [generalInflation,   setGeneralInflation]   = useState(settings.generalInflation)
  const [healthcareInflation, setHealthcareInflation] = useState(settings.healthcareInflation)
  const [travelReduction,    setTravelReduction]    = useState(settings.travelReduction)
  const [healthcareIncrease, setHealthcareIncrease] = useState(settings.healthcareIncrease)
  const [totalRate,    setTotalRate]    = useState(savingsDefaults.totalRate)
  const [longTermRate, setLongTermRate] = useState(savingsDefaults.longTermRate)
  const [emergencyRate, setEmergencyRate] = useState(savingsDefaults.emergencyRate)
  const [apiKeyInput, setApiKeyInput] = useState(apiKey || '')
  const [showKey, setShowKey] = useState(false)

  function handleReset() {
    setGeneralInflation(defaultSettings.generalInflation)
    setHealthcareInflation(defaultSettings.healthcareInflation)
    setTravelReduction(defaultSettings.travelReduction)
    setHealthcareIncrease(defaultSettings.healthcareIncrease)
    setTotalRate(defaultSavings.totalRate)
    setLongTermRate(defaultSavings.longTermRate)
    setEmergencyRate(defaultSavings.emergencyRate)
  }

  function handleSave() {
    onSave({
      generalInflation:   Math.max(0, Math.min(20,  Number(generalInflation)   || 0)),
      healthcareInflation: Math.max(0, Math.min(20, Number(healthcareInflation) || 0)),
      travelReduction:    Math.max(0, Math.min(100, Number(travelReduction)    || 0)),
      healthcareIncrease: Math.max(0, Math.min(200, Number(healthcareIncrease) || 0)),
    })
    onSaveSavingsDefaults({
      totalRate:    Number(totalRate)    || 20,
      longTermRate: Number(longTermRate) || 10,
      emergencyRate: Number(emergencyRate) || 10,
    })
    onApiKeySave(apiKeyInput.trim())
    onClose()
  }

  const subSum = (Number(longTermRate) || 0) + (Number(emergencyRate) || 0)
  const imbalanced = Math.abs(subSum - (Number(totalRate) || 0)) > 0.05

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal settings-modal">
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body settings-modal-body">

          {/* ── Inflation rates ── */}
          <p className="modal-section-label">Inflation rates</p>

          <div className="setting-row">
            <label htmlFor="general-inflation">General inflation rate</label>
            <div className="setting-input-wrap">
              <input id="general-inflation" type="number" min="0" max="20" step="0.1"
                value={generalInflation} onChange={e => setGeneralInflation(e.target.value)} className="setting-input" />
              <span className="setting-unit">%</span>
            </div>
          </div>
          <p className="modal-hint" style={{ marginTop: -4 }}>
            Auto-updated when a jurisdiction is selected (UK/US/AU: 2.5%, UAE: 1.8%, EU: 2.5%). You can override.
          </p>

          <div className="setting-row" style={{ marginTop: 10 }}>
            <label htmlFor="healthcare-inflation">Healthcare inflation rate</label>
            <div className="setting-input-wrap">
              <input id="healthcare-inflation" type="number" min="0" max="20" step="0.1"
                value={healthcareInflation} onChange={e => setHealthcareInflation(e.target.value)} className="setting-input" />
              <span className="setting-unit">%</span>
            </div>
          </div>
          <p className="modal-hint" style={{ marginTop: -4 }}>
            Applied separately to the healthcare line item in later retirement only.
          </p>

          <div className="modal-divider" />

          {/* ── Copy-forward assumptions ── */}
          <div className="settings-section-header">
            <p className="modal-section-label" style={{ margin: 0 }}>Copy-forward assumptions</p>
            <button className="settings-reset-link" onClick={handleReset}>Reset to defaults</button>
          </div>
          <p className="modal-hint">
            Applied automatically when copying active retirement figures to later retirement. All figures remain editable after copying.
          </p>

          <div className="setting-row">
            <label htmlFor="travel-reduction">Travel &amp; leisure reduction</label>
            <div className="setting-input-wrap">
              <input id="travel-reduction" type="number" min="0" max="100"
                value={travelReduction} onChange={e => setTravelReduction(e.target.value)} className="setting-input" />
              <span className="setting-unit">%</span>
            </div>
          </div>

          <div className="setting-row">
            <label htmlFor="healthcare-increase">Healthcare increase</label>
            <div className="setting-input-wrap">
              <input id="healthcare-increase" type="number" min="0" max="200"
                value={healthcareIncrease} onChange={e => setHealthcareIncrease(e.target.value)} className="setting-input" />
              <span className="setting-unit">%</span>
            </div>
          </div>

          <div className="modal-divider" />

          {/* ── Savings defaults ── */}
          <p className="modal-section-label">Savings defaults (monthly budget)</p>
          <p className="modal-hint">Default rates applied to new month columns.</p>

          <div className="setting-row">
            <label htmlFor="savings-total">Default total savings rate</label>
            <div className="setting-input-wrap">
              <input id="savings-total" type="number" min="0" max="100"
                value={totalRate} onChange={e => setTotalRate(e.target.value)} className="setting-input" />
              <span className="setting-unit">%</span>
            </div>
          </div>
          <div className="setting-row">
            <label htmlFor="savings-long">Long-term investments split</label>
            <div className="setting-input-wrap">
              <input id="savings-long" type="number" min="0" max="100"
                value={longTermRate} onChange={e => setLongTermRate(e.target.value)} className="setting-input" />
              <span className="setting-unit">%</span>
            </div>
          </div>
          <div className="setting-row">
            <label htmlFor="savings-emerg">Emergency fund split</label>
            <div className="setting-input-wrap">
              <input id="savings-emerg" type="number" min="0" max="100"
                value={emergencyRate} onChange={e => setEmergencyRate(e.target.value)} className="setting-input" />
              <span className="setting-unit">%</span>
            </div>
          </div>
          {imbalanced && (
            <p className="savings-warning" style={{ marginTop: 4 }}>
              ⚠ Sub-rates ({subSum}%) don't match total ({totalRate}%)
            </p>
          )}

          <div className="modal-divider" />

          {/* ── API key ── */}
          <p className="modal-section-label">Anthropic API key</p>
          <p className="modal-hint">Required for importing PDF bank statements. Stored locally in your browser only.</p>

          <div className="setting-row" style={{ alignItems: 'center' }}>
            <label htmlFor="api-key">API key</label>
            <div className="api-key-wrap">
              <input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="sk-ant-…"
                className="api-key-input"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="button" className="api-key-toggle" onClick={() => setShowKey(v => !v)}>
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
