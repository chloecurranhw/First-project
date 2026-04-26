import { calcMonthlyIncome, calcMonthlyExpenses, calcSavingsAmount } from '../utils/monthUtils'
import { useFmt } from '../utils/CurrencyContext'

export default function TotalsColumn({ monthColumns }) {
  const fmt = useFmt()
  const n = monthColumns.length
  if (n === 0) return null

  const totalIncome   = monthColumns.reduce((s, m) => s + calcMonthlyIncome(m.income), 0)
  const totalExpenses = monthColumns.reduce((s, m) => {
    const inc = calcMonthlyIncome(m.income)
    return s + calcMonthlyExpenses(m.expenses) + calcSavingsAmount(m.savings, inc)
  }, 0)
  const net = totalIncome - totalExpenses

  return (
    <div className="month-col month-col--totals">
      <div className="month-col-header">
        <span className="month-totals-label">Total ({n} month{n !== 1 ? 's' : ''})</span>
      </div>

      <div className="totals-spacer" />

      <div className="month-summary month-summary--totals">
        <div className="month-summary-row">
          <span>Total income</span>
          <span className="total-amount">{fmt(totalIncome)}</span>
        </div>
        <div className="month-summary-row">
          <span>Total expenses</span>
          <span className="total-amount">{fmt(totalExpenses)}</span>
        </div>
        <div className={`month-surplus ${net >= 0 ? 'month-surplus--pos' : 'month-surplus--neg'}`}>
          <span>Overall {net >= 0 ? 'surplus' : 'deficit'}</span>
          <span className="total-amount">{fmt(Math.abs(net))}</span>
        </div>
      </div>
    </div>
  )
}
