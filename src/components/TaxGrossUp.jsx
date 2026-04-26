import { useState } from 'react'
import { toAnnual } from '../utils'
import { JURISDICTIONS, JURISDICTION_INFLATION, PENSION_ORIGIN_COUNTRIES, calcGrossUp, calcGrossUpDual } from '../utils/taxUtils'
import { useFmt } from '../utils/CurrencyContext'

const TAX_GAP_TOOLTIP = 'The difference between the gross income you need to withdraw and the net amount you actually receive after tax. This is how much goes to the government.'

function inflate(pv, ratePercent, years) {
  if (years <= 0 || pv === 0) return pv
  return Math.round(pv * Math.pow(1 + ratePercent / 100, years))
}

function Tooltip({ text }) {
  const [visible, setVisible] = useState(false)
  return (
    <span
      className="tax-tooltip"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span className="tax-tooltip-trigger">i</span>
      {visible && <span className="tax-tooltip-content" role="tooltip">{text}</span>}
    </span>
  )
}

function GrossUpPanel({ label, result, dual, pensionOriginCountry, jurisdiction, fmt }) {
  if (!result) return null
  return (
    <div className="tax-result-panel">
      <h4 className="tax-result-label">{label}</h4>
      <div className="tax-result-grid">
        <span className="tax-result-row-label">Net income needed</span>
        <span className="tax-result-value">{fmt(result.net)} / year</span>

        <span className="tax-result-row-label">Tax rate applied</span>
        <span className="tax-result-value">{result.effectiveRate}% effective</span>

        <span className="tax-result-row-label">Gross income required</span>
        <span className="tax-result-value tax-result-value--highlight">{fmt(result.gross)} / year</span>

        <span className="tax-result-row-label">
          Tax gap <Tooltip text={TAX_GAP_TOOLTIP} />
        </span>
        <span className="tax-result-value tax-result-value--gap">{fmt(result.taxGap)} / year</span>
      </div>

      {dual && result.pensionNet > 0 && (
        <div className="tax-dual-breakdown">
          <p className="tax-dual-breakdown-title">Breakdown</p>
          <div className="tax-dual-row">
            <span>Pension income ({pensionOriginCountry} rules)</span>
            <span>{fmt(result.pensionNet)} → <strong>{fmt(result.pensionGross)}</strong></span>
          </div>
          <div className="tax-dual-row">
            <span>Other income ({jurisdiction} rules)</span>
            <span>{fmt(result.nonPensionNet)} → <strong>{fmt(result.nonPensionGross)}</strong></span>
          </div>
          <div className="tax-dual-row tax-dual-row--total">
            <span>Total gross income needed</span>
            <span><strong>{fmt(result.gross)}</strong></span>
          </div>
        </div>
      )}

      <p className="tax-rate-note">{result.rateNote}</p>
    </div>
  )
}

const SPLIT_FIELDS = [
  { key: 'pension',    label: 'Pension / drawdown' },
  { key: 'investment', label: 'Investment portfolio' },
  { key: 'rental',     label: 'Property rental' },
  { key: 'other',      label: 'Other' },
]

export default function TaxGrossUp({
  currentAge, retirementAge, phaseAge,
  activeItems, laterItems,
  settings,
  jurisdiction, onJurisdictionChange,
  incomeTypeSplit, onIncomeTypeSplitChange,
  dualJurisdiction, onDualJurisdictionChange,
  pensionOriginCountry, onPensionOriginCountryChange,
}) {
  const fmt = useFmt()
  const { generalInflation, healthcareInflation } = settings

  const activeYears = Math.max(0, retirementAge - currentAge)
  const laterYears  = Math.max(0, phaseAge - currentAge)

  const activeTotal = Math.round(activeItems.reduce((s, i) => s + toAnnual(i.amount, i.frequency), 0))
  const laterHealthcare    = Math.round(laterItems.filter(i => i.type === 'healthcare').reduce((s, i) => s + toAnnual(i.amount, i.frequency), 0))
  const laterNonHealthcare = Math.round(laterItems.reduce((s, i) => s + toAnnual(i.amount, i.frequency), 0)) - laterHealthcare

  const activeFV = inflate(activeTotal, generalInflation, activeYears)
  const laterFV  = inflate(laterNonHealthcare, generalInflation, laterYears) + inflate(laterHealthcare, healthcareInflation, laterYears)

  const splitTotal = SPLIT_FIELDS.reduce((s, f) => s + (Number(incomeTypeSplit[f.key]) || 0), 0)
  const splitValid = Math.abs(splitTotal - 100) <= 0.5

  const hasPension    = (incomeTypeSplit.pension || 0) > 0
  const dualActive    = dualJurisdiction && hasPension && !!pensionOriginCountry

  function calcResult(net) {
    if (!splitValid || net <= 0 || !jurisdiction) return null
    return dualActive
      ? calcGrossUpDual(net, incomeTypeSplit, jurisdiction, pensionOriginCountry)
      : calcGrossUp(net, incomeTypeSplit, jurisdiction)
  }

  const activeResult = calcResult(activeFV)
  const laterResult  = calcResult(laterFV)

  const allFlags = [...new Set([...(activeResult?.flags ?? []), ...(laterResult?.flags ?? [])])]
  const specialistAdvice = activeResult?.specialistAdvice || laterResult?.specialistAdvice

  function updateSplit(field, value) {
    onIncomeTypeSplitChange({ ...incomeTypeSplit, [field]: Number(value) || 0 })
  }

  return (
    <div className="tax-section">
      <h2 className="tax-section-title">Tax &amp; gross-up</h2>

      <div className="tax-controls">
        {/* Jurisdiction */}
        <div className="tax-jurisdiction-wrap">
          <label className="tax-label" htmlFor="jurisdiction">Jurisdiction</label>
          <select
            id="jurisdiction"
            className="tax-jurisdiction-select"
            value={jurisdiction}
            onChange={e => onJurisdictionChange(e.target.value)}
          >
            <option value="">— Select jurisdiction —</option>
            {JURISDICTIONS.map(j => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
          {jurisdiction && JURISDICTION_INFLATION[jurisdiction] !== undefined && (
            <p className="tax-jurisdiction-note">
              General inflation updated to {JURISDICTION_INFLATION[jurisdiction]}%
            </p>
          )}
        </div>

        {/* Income type split */}
        <div className="tax-split-wrap">
          <div className="tax-split-header">
            <span className="tax-label">Income type split</span>
            <span className={`tax-split-total ${splitValid ? 'tax-split-total--ok' : 'tax-split-total--warn'}`}>
              Total: {splitTotal}%{splitValid ? ' ✓' : ' — must total 100%'}
            </span>
          </div>
          <div className="tax-split-grid">
            {SPLIT_FIELDS.map(({ key, label }) => (
              <div key={key} className="tax-split-row">
                <label className="tax-split-label">{label}</label>
                <div className="tax-split-input-wrap">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={incomeTypeSplit[key] ?? 0}
                    onChange={e => updateSplit(key, e.target.value)}
                    className="tax-split-input"
                  />
                  <span className="tax-split-pct">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dual jurisdiction toggle */}
      <div className="tax-dual-toggle-wrap">
        <label className="tax-dual-toggle-label">
          <input
            type="checkbox"
            className="tax-dual-toggle-checkbox"
            checked={dualJurisdiction}
            onChange={e => onDualJurisdictionChange(e.target.checked)}
          />
          My pension comes from a different country
        </label>

        {dualJurisdiction && (
          <div className="tax-dual-origin-wrap">
            <label className="tax-split-label" htmlFor="pension-origin">Pension origin country</label>
            <select
              id="pension-origin"
              className="tax-jurisdiction-select"
              value={pensionOriginCountry}
              onChange={e => onPensionOriginCountryChange(e.target.value)}
              style={{ width: 'auto', minWidth: 160 }}
            >
              <option value="">— Select country —</option>
              {PENSION_ORIGIN_COUNTRIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {!hasPension && (
              <p className="tax-dual-note">Set pension / drawdown % above to use dual jurisdiction.</p>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {!jurisdiction && (
        <p className="tax-empty">Select a jurisdiction above to see your gross income requirements.</p>
      )}

      {jurisdiction && !splitValid && (
        <p className="tax-empty tax-empty--warn">Adjust income type percentages to total 100% to calculate gross-up.</p>
      )}

      {jurisdiction && splitValid && (activeResult || laterResult) && (
        <div className="tax-results">
          {activeResult && (
            <GrossUpPanel
              label="Active retirement"
              result={activeResult}
              dual={dualActive}
              pensionOriginCountry={pensionOriginCountry}
              jurisdiction={jurisdiction}
              fmt={fmt}
            />
          )}
          {laterResult && (
            <GrossUpPanel
              label="Later retirement"
              result={laterResult}
              dual={dualActive}
              pensionOriginCountry={pensionOriginCountry}
              jurisdiction={jurisdiction}
              fmt={fmt}
            />
          )}
        </div>
      )}

      {jurisdiction && splitValid && !activeResult && !laterResult && (
        <p className="tax-empty">Add spending figures to the retirement columns above to see gross-up calculations.</p>
      )}

      {/* Flags */}
      {allFlags.length > 0 && (
        <div className={`tax-flags ${specialistAdvice ? 'tax-flags--warn' : ''}`}>
          {specialistAdvice && <p className="tax-flags-heading">Specialist advice recommended for this jurisdiction</p>}
          {allFlags.map((flag, i) => (
            <p key={i} className="tax-flag">{flag}</p>
          ))}
        </div>
      )}
    </div>
  )
}
