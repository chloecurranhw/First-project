import { toAnnual } from '../utils'
import { calcGrossUp, calcGrossUpDual } from '../utils/taxUtils'
import { useFmt } from '../utils/CurrencyContext'

function inflate(pv, ratePercent, years) {
  if (years <= 0 || pv === 0) return pv
  return Math.round(pv * Math.pow(1 + ratePercent / 100, years))
}

export default function RetirementSummary({
  currentAge, retirementAge, phaseAge,
  activeItems, laterItems,
  settings,
  jurisdiction, incomeTypeSplit,
  dualJurisdiction, pensionOriginCountry,
}) {
  const fmt = useFmt()
  const { generalInflation, healthcareInflation, travelReduction, healthcareIncrease } = settings

  const activeYears = Math.max(0, retirementAge - currentAge)
  const laterYears  = Math.max(0, phaseAge - currentAge)

  const activeTotal = Math.round(activeItems.reduce((s, i) => s + toAnnual(i.amount, i.frequency), 0))
  const laterHealthcare    = Math.round(laterItems.filter(i => i.type === 'healthcare').reduce((s, i) => s + toAnnual(i.amount, i.frequency), 0))
  const laterNonHealthcare = Math.round(laterItems.reduce((s, i) => s + toAnnual(i.amount, i.frequency), 0)) - laterHealthcare
  const laterTotal = laterNonHealthcare + laterHealthcare

  const activeFV = inflate(activeTotal, generalInflation, activeYears)
  const laterFV  = inflate(laterNonHealthcare, generalInflation, laterYears) + inflate(laterHealthcare, healthcareInflation, laterYears)

  const splitTotal = ['pension', 'investment', 'rental', 'other'].reduce((s, k) => s + (Number(incomeTypeSplit[k]) || 0), 0)
  const splitValid = Math.abs(splitTotal - 100) <= 0.5
  const dualActive = dualJurisdiction && (incomeTypeSplit.pension || 0) > 0 && !!pensionOriginCountry

  function calcResult(net) {
    if (!splitValid || net <= 0 || !jurisdiction) return null
    return dualActive
      ? calcGrossUpDual(net, incomeTypeSplit, jurisdiction, pensionOriginCountry)
      : calcGrossUp(net, incomeTypeSplit, jurisdiction)
  }

  const activeResult = calcResult(activeFV)
  const laterResult  = calcResult(laterFV)
  const hasData = activeTotal > 0 || laterTotal > 0

  if (!hasData) return null

  function handleCopy() {
    const lines = [
      'RETIREMENT SUMMARY',
      '══════════════════',
      '',
      'ASSUMPTIONS',
      `  Current age:                 ${currentAge}`,
      `  Planned retirement age:      ${retirementAge}`,
      `  Later phase from age:        ${phaseAge}`,
      `  Years to retirement:         ${Math.max(0, retirementAge - currentAge)}`,
      `  Jurisdiction:                ${jurisdiction || '—'}`,
      `  General inflation:           ${generalInflation}%`,
      `  Healthcare inflation:        ${healthcareInflation}%`,
      `  Travel reduction (later):    ${travelReduction}%`,
      `  Healthcare uplift (later):   ${healthcareIncrease}%`,
    ]
    if (jurisdiction && splitValid) {
      lines.push(`  Income split:                Pension ${incomeTypeSplit.pension}% · Investment ${incomeTypeSplit.investment}% · Rental ${incomeTypeSplit.rental}% · Other ${incomeTypeSplit.other}%`)
    }
    lines.push('')
    lines.push('OUTPUTS')

    function phaseLines(label, net, fv, result) {
      lines.push('')
      lines.push(label)
      lines.push(`  Net spend (today's money):   ${fmt(net)} / year`)
      lines.push(`  Inflation-adjusted spend:    ${fmt(fv)} / year`)
      if (result) {
        lines.push(`  Gross income required:       ${fmt(result.gross)} / year`)
        lines.push(`  Tax gap:                     ${fmt(result.taxGap)} / year (${result.effectiveRate}% effective rate)`)
      }
    }

    if (activeTotal > 0) phaseLines(`Active retirement (age ${retirementAge}–${phaseAge})`, activeTotal, activeFV, activeResult)
    if (laterTotal > 0)  phaseLines(`Later retirement (age ${phaseAge}+)`, laterTotal, laterFV, laterResult)

    lines.push('')
    lines.push('This tool provides estimates only and does not constitute financial or tax advice.')
    navigator.clipboard.writeText(lines.join('\n'))
  }

  return (
    <div className="summary-card">
      <div className="summary-header">
        <h2 className="summary-title">Retirement summary</h2>
        <button className="summary-copy-btn" onClick={handleCopy}>Copy summary</button>
      </div>

      <div className="summary-assumptions">
        <h3 className="summary-section-label">Assumptions</h3>
        <div className="summary-assumption-grid">
          <span className="summary-assumption-label">Current age</span>
          <span className="summary-assumption-value">{currentAge}</span>
          <span className="summary-assumption-label">Retirement age</span>
          <span className="summary-assumption-value">{retirementAge}</span>
          <span className="summary-assumption-label">Later phase from age</span>
          <span className="summary-assumption-value">{phaseAge}</span>
          <span className="summary-assumption-label">Years to retirement</span>
          <span className="summary-assumption-value">{Math.max(0, retirementAge - currentAge)}</span>
          <span className="summary-assumption-label">Jurisdiction</span>
          <span className="summary-assumption-value">{jurisdiction || '—'}</span>
          <span className="summary-assumption-label">General inflation</span>
          <span className="summary-assumption-value">{generalInflation}%</span>
          <span className="summary-assumption-label">Healthcare inflation</span>
          <span className="summary-assumption-value">{healthcareInflation}%</span>
          <span className="summary-assumption-label">Travel reduction (later)</span>
          <span className="summary-assumption-value">{travelReduction}%</span>
          <span className="summary-assumption-label">Healthcare uplift (later)</span>
          <span className="summary-assumption-value">{healthcareIncrease}%</span>
          {jurisdiction && splitValid && (
            <>
              <span className="summary-assumption-label">Income split</span>
              <span className="summary-assumption-value" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>Pension {incomeTypeSplit.pension}%</span>
                <span>Investment {incomeTypeSplit.investment}%</span>
                <span>Rental {incomeTypeSplit.rental}%</span>
                <span>Other {incomeTypeSplit.other}%</span>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="summary-phases">
        {activeTotal > 0 && (
          <div className="summary-phase">
            <h3 className="summary-phase-title">
              Active retirement
              <span className="summary-phase-ages">age {retirementAge}–{phaseAge}</span>
            </h3>
            <div className="summary-phase-grid">
              <span className="summary-phase-label">Net spend (today's money)</span>
              <span className="summary-phase-value">{fmt(activeTotal)} / year</span>
              <span className="summary-phase-label">Inflation-adjusted spend</span>
              <span className="summary-phase-value summary-phase-value--future">{fmt(activeFV)} / year</span>
              {activeResult && <>
                <span className="summary-phase-label">Gross income required</span>
                <span className="summary-phase-value summary-phase-value--highlight">{fmt(activeResult.gross)} / year</span>
                <span className="summary-phase-label">Tax gap</span>
                <span className="summary-phase-value summary-phase-value--gap">{fmt(activeResult.taxGap)} / year</span>
              </>}
            </div>
          </div>
        )}

        {laterTotal > 0 && (
          <div className="summary-phase">
            <h3 className="summary-phase-title">
              Later retirement
              <span className="summary-phase-ages">age {phaseAge}+</span>
            </h3>
            <div className="summary-phase-grid">
              <span className="summary-phase-label">Net spend (today's money)</span>
              <span className="summary-phase-value">{fmt(laterTotal)} / year</span>
              <span className="summary-phase-label">Inflation-adjusted spend</span>
              <span className="summary-phase-value summary-phase-value--future">{fmt(laterFV)} / year</span>
              {laterResult && <>
                <span className="summary-phase-label">Gross income required</span>
                <span className="summary-phase-value summary-phase-value--highlight">{fmt(laterResult.gross)} / year</span>
                <span className="summary-phase-label">Tax gap</span>
                <span className="summary-phase-value summary-phase-value--gap">{fmt(laterResult.taxGap)} / year</span>
              </>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
