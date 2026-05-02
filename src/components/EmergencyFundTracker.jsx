import { useState } from 'react'
import { calcMonthlyIncome, calcMonthlyExpenses } from '../utils/monthUtils'
import { useContext } from 'react'
import { CurrencyContext, useFmt } from '../utils/CurrencyContext'

export default function EmergencyFundTracker({ monthColumns, state, onChange }) {
  const fmt = useFmt()
  const currencySymbol = useContext(CurrencyContext)
  const [draftAmount, setDraftAmount] = useState(null)

  const avgMonthlyExpenses = monthColumns.length
    ? monthColumns.reduce((s, m) => s + calcMonthlyExpenses(m.expenses), 0) / monthColumns.length
    : 0

  const cumEmergencyContribs = monthColumns.reduce((s, m) => {
    const inc = calcMonthlyIncome(m.income)
    return s + inc * (m.savings.emergencyRate / 100)
  }, 0)

  const targetMonths   = parseFloat(state.targetMonths) || 0
  const existingSaved  = parseFloat(state.existingSavings) || 0
  const contributionPct = parseFloat(state.contributionPct) || 0
  const contributionAmt = avgMonthlyExpenses * (contributionPct / 100)

  const target        = avgMonthlyExpenses * targetMonths
  const current       = cumEmergencyContribs + existingSaved
  const remaining     = target - current
  const monthsCovered = avgMonthlyExpenses > 0 ? current / avgMonthlyExpenses : 0
  const pct           = target > 0 ? Math.min(100, (current / target) * 100) : 0
  const reached       = remaining <= 0

  const monthsToGoal = contributionAmt > 0 && remaining > 0
    ? Math.ceil(remaining / contributionAmt)
    : null

  function handlePctChange(e) {
    setDraftAmount(null)
    onChange({ ...state, contributionPct: e.target.value })
  }

  function handleAmountFocus() {
    setDraftAmount(contributionAmt > 0 ? String(Math.round(contributionAmt)) : '')
  }

  function handleAmountChange(e) {
    const raw = e.target.value
    setDraftAmount(raw)
    const amt = parseFloat(raw) || 0
    const newPct = avgMonthlyExpenses > 0
      ? Math.round((amt / avgMonthlyExpenses) * 1000) / 10
      : 0
    onChange({ ...state, contributionPct: String(newPct) })
  }

  function handleAmountBlur() {
    setDraftAmount(null)
  }

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
            <span className="amount-prefix">{currencySymbol}</span>
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
        <div className="ef-input-row">
          <label>
            Planned monthly contribution
            <span className="ef-hint">Enter a percentage or amount — both stay in sync.</span>
          </label>
          <div className="ef-contribution-inputs">
            <div className="ef-contribution-pct-wrap">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                className="ef-number-input"
                value={state.contributionPct}
                onChange={handlePctChange}
                placeholder="0"
              />
              <span className="ef-contribution-unit">% of expenses</span>
            </div>
            <span className="ef-contribution-sep">or</span>
            <div className="amount-wrap" style={{ width: 130 }}>
              <span className="amount-prefix">{currencySymbol}</span>
              <input
                type="number"
                min="0"
                className="amount-input"
                value={draftAmount !== null ? draftAmount : (contributionAmt > 0 ? String(Math.round(contributionAmt)) : '')}
                onChange={handleAmountChange}
                onFocus={handleAmountFocus}
                onBlur={handleAmountBlur}
                placeholder="0"
              />
            </div>
            <span className="ef-contribution-unit">/ month</span>
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
            {monthsToGoal !== null && (
              <> At {fmt(contributionAmt)}/month, you'll reach your target in <strong>{monthsToGoal}</strong> month{monthsToGoal !== 1 ? 's' : ''}.</>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
