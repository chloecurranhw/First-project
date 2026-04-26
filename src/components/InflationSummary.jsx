import { toAnnual } from '../utils'
import { useFmt } from '../utils/CurrencyContext'

function inflate(pv, ratePercent, years) {
  if (years <= 0 || pv === 0) return pv
  return Math.round(pv * Math.pow(1 + ratePercent / 100, years))
}

function calcColumnTotal(items) {
  return items.reduce((s, i) => s + toAnnual(i.amount, i.frequency), 0)
}

export default function InflationSummary({ currentAge, retirementAge, phaseAge, activeItems, laterItems, settings }) {
  const { generalInflation, healthcareInflation } = settings
  const fmt = useFmt()

  const activeYears = Math.max(0, retirementAge - currentAge)
  const laterYears  = Math.max(0, phaseAge - currentAge)

  const activeTotal = Math.round(calcColumnTotal(activeItems))

  const laterHealthcare    = Math.round(laterItems.filter(i => i.type === 'healthcare').reduce((s, i) => s + toAnnual(i.amount, i.frequency), 0))
  const laterNonHealthcare = Math.round(calcColumnTotal(laterItems)) - laterHealthcare
  const laterTotal         = laterNonHealthcare + laterHealthcare

  const activeFV = inflate(activeTotal, generalInflation, activeYears)
  const laterFV  = inflate(laterNonHealthcare, generalInflation, laterYears) + inflate(laterHealthcare, healthcareInflation, laterYears)

  const hasActiveData = activeTotal > 0
  const hasLaterData  = laterTotal > 0
  const hasAnyData    = hasActiveData || hasLaterData

  if (!hasAnyData) return null

  return (
    <div className="inflation-summary">
      <h2 className="inflation-summary-title">Inflation-adjusted summary</h2>

      {hasActiveData && (
        <div className="inflation-block">
          <p className="inflation-block-heading">
            Your active retirement starts at age <strong>{retirementAge}</strong>
          </p>
          <div className="inflation-row">
            <span className="inflation-label">Today's money</span>
            <span className="inflation-value">{fmt(activeTotal)} / year</span>
            <span className="inflation-arrow">→</span>
            <span className="inflation-label">In {activeYears} year{activeYears !== 1 ? 's' : ''} at {generalInflation}%</span>
            <span className="inflation-value inflation-value--future">{fmt(activeFV)} / year</span>
          </div>
          <p className="inflation-plain">
            You've said you'll spend <strong>{fmt(activeTotal)}</strong> per year in active retirement.
            In today's money that's <strong>{fmt(activeTotal)}</strong>.
            In {activeYears} year{activeYears !== 1 ? 's' : ''} at {generalInflation}% inflation,
            you'll need <strong>{fmt(activeFV)}</strong> to buy the same things.
          </p>
        </div>
      )}

      {hasLaterData && (
        <div className="inflation-block">
          <p className="inflation-block-heading">
            Your later retirement starts at age <strong>{phaseAge}</strong>
          </p>
          <div className="inflation-row">
            <span className="inflation-label">Today's money</span>
            <span className="inflation-value">{fmt(laterTotal)} / year</span>
            <span className="inflation-arrow">→</span>
            <span className="inflation-label">In {laterYears} year{laterYears !== 1 ? 's' : ''} at {generalInflation}%{laterHealthcare > 0 ? ` / ${healthcareInflation}% healthcare` : ''}</span>
            <span className="inflation-value inflation-value--future">{fmt(laterFV)} / year</span>
          </div>
          {laterHealthcare > 0 && (
            <p className="inflation-note">
              Healthcare ({fmt(laterHealthcare)}/yr today) inflated at {healthcareInflation}%; all other items at {generalInflation}%.
            </p>
          )}
          <p className="inflation-plain">
            You've said you'll spend <strong>{fmt(laterTotal)}</strong> per year in later retirement.
            In today's money that's <strong>{fmt(laterTotal)}</strong>.
            In {laterYears} year{laterYears !== 1 ? 's' : ''} at {generalInflation}% inflation{laterHealthcare > 0 ? ` (healthcare at ${healthcareInflation}%)` : ''},
            you'll need <strong>{fmt(laterFV)}</strong> to buy the same things.
          </p>
        </div>
      )}
    </div>
  )
}
