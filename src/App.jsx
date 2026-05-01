import { useState } from 'react'
import Column from './components/Column'
import SettingsModal from './components/SettingsModal'
import TabBar from './components/TabBar'
import MonthlyBudget from './components/MonthlyBudget'
import ConfirmDialog from './components/ConfirmDialog'
import { createDefaultItems, generateId } from './utils'
import { createDefaultMonths } from './utils/monthUtils'
import InflationSummary from './components/InflationSummary'
import TaxGrossUp from './components/TaxGrossUp'
import RetirementSummary from './components/RetirementSummary'
import { JURISDICTION_INFLATION } from './utils/taxUtils'
import { CurrencyContext, CURRENCIES } from './utils/CurrencyContext'

function applyAdjustment(amount, percentageChange) {
  const amt = parseFloat(amount) || 0
  if (amt === 0) return ''
  return String(Math.round(amt * (1 + percentageChange / 100) * 100) / 100)
}

const DEFAULT_SAVINGS = { totalRate: 20, longTermRate: 10, emergencyRate: 10 }
const DEFAULT_SETTINGS = { travelReduction: 20, healthcareIncrease: 30, generalInflation: 2, healthcareInflation: 4 }

export default function App() {
  const [activeTab, setActiveTab] = useState('monthly')
  const [resetConfirm, setResetConfirm] = useState(false)

  // ── Retirement planner state ─────────────────────────────
  const [currentAge, setCurrentAge] = useState(45)
  const [retirementAge, setRetirementAge] = useState(65)
  const [phaseAge, setPhaseAge] = useState(75)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [columns, setColumns] = useState({
    current: { items: createDefaultItems(), oneOffEvents: [] },
    active:  { items: createDefaultItems(), oneOffEvents: [] },
    later:   { items: createDefaultItems(), oneOffEvents: [], banner: null },
  })

  // ── API key (for PDF import) ─────────────────────────────
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('hx_api_key') || '')

  function handleApiKeySave(key) {
    setApiKey(key)
    if (key) localStorage.setItem('hx_api_key', key)
    else localStorage.removeItem('hx_api_key')
  }

  // ── Currency ─────────────────────────────────────────────
  const [currencySymbol, setCurrencySymbol] = useState('$')

  // ── Tax gross-up state ───────────────────────────────────
  const [jurisdiction, setJurisdiction] = useState('')
  const [incomeTypeSplit, setIncomeTypeSplit] = useState({ pension: 100, investment: 0, rental: 0, other: 0 })
  const [dualJurisdiction, setDualJurisdiction] = useState(false)
  const [pensionOriginCountry, setPensionOriginCountry] = useState('')

  function handleJurisdictionChange(jur) {
    setJurisdiction(jur)
    if (jur && JURISDICTION_INFLATION[jur] !== undefined) {
      setSettings(prev => ({ ...prev, generalInflation: JURISDICTION_INFLATION[jur] }))
    }
  }

  // ── Monthly budget state ─────────────────────────────────
  const [monthCount, setMonthCount] = useState(3)
  const [savingsDefaults, setSavingsDefaults] = useState(DEFAULT_SAVINGS)
  const [monthColumns, setMonthColumns] = useState(() => createDefaultMonths(3, DEFAULT_SAVINGS))
  const [emergencyFundState, setEmergencyFundState] = useState({ targetMonths: 3, existingSavings: 0 })

  // ── Retirement helpers ────────────────────────────────────
  function handleRetirementItemsChange(columnId, items) {
    setColumns(prev => ({ ...prev, [columnId]: { ...prev[columnId], items } }))
  }

  function handleOneOffEventsChange(columnId, oneOffEvents) {
    setColumns(prev => ({ ...prev, [columnId]: { ...prev[columnId], oneOffEvents } }))
  }

  function copyToActive() {
    const newItems = columns.current.items.map(i => ({ ...i, id: generateId() }))
    setColumns(prev => ({ ...prev, active: { ...prev.active, items: newItems } }))
  }

  function copyToLater() {
    const newItems = columns.active.items.map(item => {
      const ni = { ...item, id: generateId() }
      if (item.type === 'travel'     && settings.travelReduction   > 0) ni.amount = applyAdjustment(item.amount, -settings.travelReduction)
      if (item.type === 'healthcare' && settings.healthcareIncrease > 0) ni.amount = applyAdjustment(item.amount,  settings.healthcareIncrease)
      return ni
    })
    const hasBanner = settings.travelReduction > 0 || settings.healthcareIncrease > 0
    setColumns(prev => ({
      ...prev,
      later: {
        items: newItems,
        banner: hasBanner
          ? { dismissed: false, travelReduction: settings.travelReduction, healthcareIncrease: settings.healthcareIncrease }
          : null,
      },
    }))
  }

  function dismissBanner() {
    setColumns(prev => ({
      ...prev,
      later: { ...prev.later, banner: prev.later.banner ? { ...prev.later.banner, dismissed: true } : null },
    }))
  }

  // ── Copy monthly → retirement ─────────────────────────────
  function handleCopyToRetirement(annualItems) {
    setColumns(prev => ({ ...prev, current: { items: annualItems } }))
  }

  // ── Reset all planning data ───────────────────────────────
  function handleReset() {
    setCurrentAge(45)
    setRetirementAge(65)
    setPhaseAge(75)
    setSettings(DEFAULT_SETTINGS)
    setColumns({
      current: { items: createDefaultItems(), oneOffEvents: [] },
      active:  { items: createDefaultItems(), oneOffEvents: [] },
      later:   { items: createDefaultItems(), oneOffEvents: [], banner: null },
    })
    setJurisdiction('')
    setIncomeTypeSplit({ pension: 100, investment: 0, rental: 0, other: 0 })
    setDualJurisdiction(false)
    setPensionOriginCountry('')
    setMonthCount(3)
    setSavingsDefaults(DEFAULT_SAVINGS)
    setMonthColumns(createDefaultMonths(3, DEFAULT_SAVINGS))
    setEmergencyFundState({ targetMonths: 3, existingSavings: 0 })
    setResetConfirm(false)
  }

  return (
    <CurrencyContext.Provider value={currencySymbol}>
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <a href="https://www.hoxtonwealth.com" target="_blank" rel="noopener noreferrer" style={{ lineHeight: 0, border: 'none' }}>
            <img
              src="/HoxtonWealth_Lockup_Deep_Green-RGB.png"
              alt="HoxtonWealth Planner"
              className="header-logo"
              onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'block' }}
            />
          </a>
          <h1 className="app-title" style={{ display: 'none' }}>HoxtonWealth Planner</h1>
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
        <div className="header-right">
          <select
            className="currency-select"
            value={currencySymbol}
            onChange={e => setCurrencySymbol(e.target.value)}
            aria-label="Currency"
          >
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.symbol}>{c.label}</option>
            ))}
          </select>
          {activeTab === 'retirement' && (
            <div className="phase-age-control">
              <label htmlFor="phase-age">Active / later boundary: age</label>
              <input
                id="phase-age"
                type="number"
                min="50"
                max="100"
                value={phaseAge}
                onChange={e => setPhaseAge(parseInt(e.target.value, 10) || 75)}
                className="phase-age-input"
              />
            </div>
          )}
          <button className="reset-btn" onClick={() => setResetConfirm(true)}>
            Reset tool
          </button>
          <button className="settings-btn" onClick={() => setSettingsOpen(true)}>
            ⚙ Settings
          </button>
        </div>
      </header>

      {/* ── Monthly budget tab ─────────────────────────────── */}
      {activeTab === 'monthly' && (
        <MonthlyBudget
          monthCount={monthCount}
          onMonthCountChange={setMonthCount}
          monthColumns={monthColumns}
          onMonthColumnsChange={setMonthColumns}
          emergencyFundState={emergencyFundState}
          onEmergencyFundChange={setEmergencyFundState}
          savingsDefaults={savingsDefaults}
          onCopyToRetirement={handleCopyToRetirement}
          onSwitchToRetirement={() => setActiveTab('retirement')}
          apiKey={apiKey}
        />
      )}

      {/* ── Retirement planner tab ─────────────────────────── */}
      {activeTab === 'retirement' && (
        <div className="retirement-tab">
          <div className="retirement-context-bar">
            <div className="context-field">
              <label htmlFor="current-age">Your current age</label>
              <input
                id="current-age"
                type="number"
                min="18"
                max="100"
                value={currentAge}
                onChange={e => setCurrentAge(parseInt(e.target.value, 10) || 45)}
                className="context-age-input"
              />
            </div>
            <div className="context-field">
              <label htmlFor="retirement-age">Planned retirement age</label>
              <input
                id="retirement-age"
                type="number"
                min="18"
                max="100"
                value={retirementAge}
                onChange={e => setRetirementAge(parseInt(e.target.value, 10) || 65)}
                className="context-age-input"
              />
            </div>
            <div className="context-field context-field--derived">
              <span className="context-derived-label">Years to retirement</span>
              <span className="context-derived-value">{Math.max(0, retirementAge - currentAge)}</span>
            </div>
          </div>

          <main className="columns-grid">
            <Column
              columnId="current"
              title="Current lifestyle"
              subtitle="Reference — not for planning"
              items={columns.current.items}
              onItemsChange={handleRetirementItemsChange}
              oneOffEvents={columns.current.oneOffEvents}
              onOneOffEventsChange={handleOneOffEventsChange}
              copyButton={{ label: 'Copy to active retirement →', onClick: copyToActive }}
              tip={{
                message: 'Tip: fill in your monthly budget first, then copy it here.',
                action: { label: 'Go to monthly budget', onClick: () => setActiveTab('monthly') },
              }}
            />
            <Column
              columnId="active"
              title="Active retirement"
              subtitle={`From age ${retirementAge} to ${phaseAge}`}
              items={columns.active.items}
              onItemsChange={handleRetirementItemsChange}
              oneOffEvents={columns.active.oneOffEvents}
              onOneOffEventsChange={handleOneOffEventsChange}
              copyButton={{ label: 'Copy to later retirement →', onClick: copyToLater }}
            />
            <Column
              columnId="later"
              title="Later retirement"
              subtitle={`From age ${phaseAge} onwards`}
              items={columns.later.items}
              onItemsChange={handleRetirementItemsChange}
              oneOffEvents={columns.later.oneOffEvents}
              onOneOffEventsChange={handleOneOffEventsChange}
              banner={columns.later.banner}
              onDismissBanner={dismissBanner}
            />
          </main>

          <InflationSummary
            currentAge={currentAge}
            retirementAge={retirementAge}
            phaseAge={phaseAge}
            activeItems={columns.active.items}
            laterItems={columns.later.items}
            settings={settings}
          />

          <TaxGrossUp
            currentAge={currentAge}
            retirementAge={retirementAge}
            phaseAge={phaseAge}
            activeItems={columns.active.items}
            laterItems={columns.later.items}
            settings={settings}
            jurisdiction={jurisdiction}
            onJurisdictionChange={handleJurisdictionChange}
            incomeTypeSplit={incomeTypeSplit}
            onIncomeTypeSplitChange={setIncomeTypeSplit}
            dualJurisdiction={dualJurisdiction}
            onDualJurisdictionChange={setDualJurisdiction}
            pensionOriginCountry={pensionOriginCountry}
            onPensionOriginCountryChange={setPensionOriginCountry}
          />

          <RetirementSummary
            currentAge={currentAge}
            retirementAge={retirementAge}
            phaseAge={phaseAge}
            activeItems={columns.active.items}
            laterItems={columns.later.items}
            settings={settings}
            jurisdiction={jurisdiction}
            incomeTypeSplit={incomeTypeSplit}
            dualJurisdiction={dualJurisdiction}
            pensionOriginCountry={pensionOriginCountry}
          />

          <p className="disclaimer">
            This tool provides estimates only and does not constitute financial or tax advice.
            All figures should be reviewed with a qualified financial adviser.
          </p>
        </div>
      )}

      {resetConfirm && (
        <ConfirmDialog
          title="Reset tool"
          message="This will clear all your planning data — retirement columns, monthly budget, and all settings. This cannot be undone."
          confirmLabel="Reset everything"
          cancelLabel="Cancel"
          onConfirm={handleReset}
          onCancel={() => setResetConfirm(false)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          defaultSettings={DEFAULT_SETTINGS}
          savingsDefaults={savingsDefaults}
          defaultSavings={DEFAULT_SAVINGS}
          onSave={setSettings}
          onSaveSavingsDefaults={setSavingsDefaults}
          apiKey={apiKey}
          onApiKeySave={handleApiKeySave}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
    </CurrencyContext.Provider>
  )
}
