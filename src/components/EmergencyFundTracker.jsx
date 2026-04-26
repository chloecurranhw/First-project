import { calcMonthlyIncome, calcMonthlyExpenses } from '../utils/monthUtils'
import { useFmt } from '../utils/CurrencyContext'

export default function EmergencyFundTracker({ monthColumns, state, onChange }) {
  const fmt = useFmt()
  const avgMonthlyExpenses = monthColumns.length
    ? monthColumns.reduce((s, m) => s + calcMonthlyExpenses(m.expenses), 0) / monthColumns.length
    : 0

  const cumEmergencyContribs = monthColumns.reduce((s, m) => {
    const inc = calcMonthlyIncome(m.income)
    return s + inc * (m.savings.emergencyRate / 100)
  }, 0)

  const targetMonths   = parseFloat(state.targetMonths) || 0
  const existingSaved  = parseFloat(state.existingSavings) || 0
  const target         = avgMonthlyExpenses * targetMonths
  const current        = cumEmergencyContribs + existingSaved
  const remaining      = target - current
  const monthsCovered  = avgMonthlyExpenses > 0 ? current / avgMonthlyExpenses : 0
  const pct            = target > 0 ? Math.min(100, (current / target) * 100) : 0
  const reached        = remaining <= 0

  return (
    <div className="ef-tracker">
      <h2 className="ef-title">Emergency fund tracker</h2>

      <div className="ef-inputs">
        <div className="ef-input-row">
          <label>
            How many months of expenses do you want in your emergency fund?
            <span className="ef-hint">Most financial advisers recommend 3–6 months.</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            className="ef-number-input"
            value={state.targetMonths}
            onChange={e => onChange({ ...state, targetMonths: e.target.value })}
          />
        </div>
        <div className="ef-input-row">
          <label>How much do you already have saved in your emergency fund?</label>
          <div className="amount-wrap" style={{ width: 130 }}>
            <span className="amount-prefix">$</span>
            <input
              type="number"
              min="0"
              className="amount-input"
              value={state.existingSavings}
              onChange={e => onChange({ ...state, existingSavings: e.target.value })}
              placeholder="0"
            />
          </div>
        </div>
      </div>

      <div className="ef-calculations">
        <div className="ef-calc-grid">
          <div className="ef-stat">
            <span className="ef-stat-label">Average monthly expenses</span>
            <span className="ef-stat-value">{fmt(avgMonthlyExpenses)}</span>
          </div>
          <div className="ef-stat">
            <span className="ef-stat-label">Target ({targetMonths} months)</span>
            <span className="ef-stat-value">{fmt(target)}</span>
          </div>
          <div className="ef-stat">
            <span className="ef-stat-label">Emergency fund contributions</span>
            <span className="ef-stat-value">{fmt(cumEmergencyContribs)}</span>
          </div>
          <div className="ef-stat">
            <span className="ef-stat-label">Current total</span>
            <span className="ef-stat-value ef-stat-value--current">{fmt(current)}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="ef-progress-wrap">
          <div className="ef-progress-bar-track">
            <div
              className={`ef-progress-bar-fill ${reached ? 'ef-progress-bar-fill--reached' : 'ef-progress-bar-fill--short'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className={`ef-progress-label ${reached ? 'ef-progress-label--reached' : 'ef-progress-label--short'}`}>
            {reached
              ? `Target reached. You have ${monthsCovered.toFixed(1)} months of expenses covered.`
              : `You are ${fmt(remaining)} short of your ${targetMonths}-month target of ${fmt(target)}.`
            }
          </div>
          <div className="ef-months-covered">
            Your current savings cover <strong>{monthsCovered.toFixed(1)}</strong> months of expenses.
          </div>
        </div>
      </div>
    </div>
  )
}
