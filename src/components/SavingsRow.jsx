import { useState, useContext } from 'react'
import { calcSavingsAmount, redistributeSavings } from '../utils/monthUtils'
import { useFmt, CurrencyContext } from '../utils/CurrencyContext'

export default function SavingsRow({ savings, monthlyIncome, onChange }) {
  const fmt = useFmt()
  const currencySymbol = useContext(CurrencyContext)
  const [draftAmount, setDraftAmount] = useState(null)

  const savingsAmt = calcSavingsAmount(savings, monthlyIncome)
  const longAmt  = monthlyIncome * (savings.longTermRate  / 100)
  const emergAmt = monthlyIncome * (savings.emergencyRate / 100)
  const subSum   = savings.longTermRate + savings.emergencyRate
  const imbalanced = Math.abs(subSum - savings.totalRate) > 0.05

  function updateSavings(field, value) {
    if (['totalRate', 'longTermRate', 'emergencyRate'].includes(field)) {
      onChange(redistributeSavings(savings, field, value))
    } else {
      onChange({ ...savings, [field]: value })
    }
  }

  function handleAmountFocus() {
    setDraftAmount(savingsAmt > 0 ? String(Math.round(savingsAmt)) : '')
  }

  function handleAmountChange(e) {
    const raw = e.target.value
    setDraftAmount(raw)
    const amt = parseFloat(raw) || 0
    if (monthlyIncome > 0) {
      const newRate = Math.round((amt / monthlyIncome) * 1000) / 10
      onChange(redistributeSavings(savings, 'totalRate', String(newRate)))
    }
  }

  function handleAmountBlur() {
    setDraftAmount(null)
  }

  return (
    <div className="savings-row-wrap">
      {/* Main savings row */}
      <div className="savings-row">
        <button
          className="savings-expand-btn"
          onClick={() => onChange({ ...savings, expanded: !savings.expanded })}
          aria-label={savings.expanded ? 'Collapse savings' : 'Expand savings'}
        >
          {savings.expanded ? '▾' : '▸'}
        </button>

        <span className="savings-label">Savings</span>

        <span className="savings-rate-wrap">
          <input
            className="savings-rate-input"
            type="number"
            min="0"
            max="100"
            value={savings.totalRate}
            onChange={e => updateSavings('totalRate', e.target.value)}
          />
          <span className="savings-rate-pct">% of income</span>
        </span>

        <div className="amount-wrap">
          <span className="amount-prefix">{currencySymbol}</span>
          <input
            className="amount-input"
            type="number"
            min="0"
            value={draftAmount !== null ? draftAmount : (savingsAmt > 0 ? String(Math.round(savingsAmt)) : '')}
            onChange={handleAmountChange}
            onFocus={handleAmountFocus}
            onBlur={handleAmountBlur}
            placeholder="0"
          />
        </div>
      </div>

      <p className="savings-note">Auto-calculated at {savings.totalRate}% of income</p>

      {/* Expandable sub-rows */}
      {savings.expanded && (
        <div className="savings-sub-rows">
          {imbalanced && (
            <div className="savings-warning">
              ⚠ Sub-percentages ({subSum}%) don't match total savings rate ({savings.totalRate}%)
            </div>
          )}

          <div className="savings-sub-row">
            <span className="savings-sub-label">Long-term investments</span>
            <span className="savings-sub-rate-wrap">
              <input
                className="savings-rate-input"
                type="number"
                min="0"
                max="100"
                value={savings.longTermRate}
                onChange={e => updateSavings('longTermRate', e.target.value)}
              />
              <span className="savings-rate-pct">%</span>
            </span>
            <span className="savings-sub-amount">{fmt(longAmt)}<span className="savings-sub-freq">/mo</span></span>
          </div>

          <div className="savings-sub-row">
            <span className="savings-sub-label">Emergency fund</span>
            <span className="savings-sub-rate-wrap">
              <input
                className="savings-rate-input"
                type="number"
                min="0"
                max="100"
                value={savings.emergencyRate}
                onChange={e => updateSavings('emergencyRate', e.target.value)}
              />
              <span className="savings-rate-pct">%</span>
            </span>
            <span className="savings-sub-amount">{fmt(emergAmt)}<span className="savings-sub-freq">/mo</span></span>
          </div>
        </div>
      )}
    </div>
  )
}
