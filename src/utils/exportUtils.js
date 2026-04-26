import * as XLSX from 'xlsx'
import { toMonthly, calcMonthlyIncome, calcSavingsAmount } from './monthUtils'
import { toAnnual } from '../utils'

function dateStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

function fmt(n) { return Math.round(n * 100) / 100 }

export function exportCSV(monthColumns) {
  const rows = [['Category', 'Type', 'Month', 'Frequency', 'Amount', 'Annual Equivalent']]

  for (const month of monthColumns) {
    for (const item of month.income) {
      rows.push([item.label, 'income', month.name, item.frequency, fmt(parseFloat(item.amount) || 0), fmt(toAnnual(item.amount, item.frequency))])
    }

    const monthlyIncome = calcMonthlyIncome(month.income)
    const savingsAmt = calcSavingsAmount(month.savings, monthlyIncome)
    rows.push(['Savings', 'savings', month.name, 'monthly', fmt(savingsAmt), fmt(savingsAmt * 12)])

    const longAmt = monthlyIncome * (month.savings.longTermRate / 100)
    rows.push(['Long-term investments', 'savings-sub', month.name, 'monthly', fmt(longAmt), fmt(longAmt * 12)])

    const emergAmt = monthlyIncome * (month.savings.emergencyRate / 100)
    rows.push(['Emergency fund', 'savings-sub', month.name, 'monthly', fmt(emergAmt), fmt(emergAmt * 12)])

    for (const item of month.expenses) {
      rows.push([item.label, item.category, month.name, item.frequency, fmt(parseFloat(item.amount) || 0), fmt(toAnnual(item.amount, item.frequency))])
    }
  }

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: `HoxtonWealth_Budget_${dateStr()}.csv` })
  a.click()
  URL.revokeObjectURL(url)
}

export function exportExcel(monthColumns, emergencyFundState) {
  const wb = XLSX.utils.book_new()

  // ── Budget sheet ──────────────────────────────────────────
  const headers = ['Category', 'Type', ...monthColumns.map(m => m.name), `Total (${monthColumns.length} months)`]
  const rows = [headers]

  const addRow = (label, type, getMonthValue) => {
    let total = 0
    const cols = monthColumns.map(m => { const v = getMonthValue(m); total += v; return fmt(v) })
    rows.push([label, type, ...cols, fmt(total)])
  }

  rows.push(['INCOME', '', ...monthColumns.map(() => ''), ''])
  const incomeLabels = [...new Set(monthColumns.flatMap(m => m.income.map(i => i.label)))]
  for (const label of incomeLabels) {
    addRow(label, 'income', m => {
      const item = m.income.find(i => i.label === label)
      return item ? toMonthly(item.amount, item.frequency) : 0
    })
  }
  addRow('Total income', 'income-total', m => calcMonthlyIncome(m.income))

  rows.push(['', '', ...monthColumns.map(() => ''), ''])
  rows.push(['SAVINGS', '', ...monthColumns.map(() => ''), ''])
  addRow('Savings (total)', 'savings', m => calcSavingsAmount(m.savings, calcMonthlyIncome(m.income)))
  addRow('  Long-term investments', 'savings-sub', m => calcMonthlyIncome(m.income) * (m.savings.longTermRate / 100))
  addRow('  Emergency fund', 'savings-sub', m => calcMonthlyIncome(m.income) * (m.savings.emergencyRate / 100))

  rows.push(['', '', ...monthColumns.map(() => ''), ''])
  rows.push(['EXPENSES — NEEDS', '', ...monthColumns.map(() => ''), ''])
  const needsLabels = [...new Set(monthColumns.flatMap(m => m.expenses.filter(e => e.category === 'needs').map(e => e.label)))]
  for (const label of needsLabels) {
    addRow(label, 'needs', m => {
      const item = m.expenses.find(e => e.label === label && e.category === 'needs')
      return item ? toMonthly(item.amount, item.frequency) : 0
    })
  }

  rows.push(['', '', ...monthColumns.map(() => ''), ''])
  rows.push(['EXPENSES — WANTS', '', ...monthColumns.map(() => ''), ''])
  const wantsLabels = [...new Set(monthColumns.flatMap(m => m.expenses.filter(e => e.category === 'wants').map(e => e.label)))]
  for (const label of wantsLabels) {
    addRow(label, 'wants', m => {
      const item = m.expenses.find(e => e.label === label && e.category === 'wants')
      return item ? toMonthly(item.amount, item.frequency) : 0
    })
  }

  rows.push(['', '', ...monthColumns.map(() => ''), ''])
  addRow('Total expenses (incl. savings)', 'expense-total', m => {
    const inc = calcMonthlyIncome(m.income)
    return calcSavingsAmount(m.savings, inc) +
      m.expenses.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0)
  })
  addRow('Surplus / Deficit', 'surplus', m => {
    const inc = calcMonthlyIncome(m.income)
    const exp = calcSavingsAmount(m.savings, inc) +
      m.expenses.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0)
    return inc - exp
  })

  const budgetWS = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, budgetWS, 'Monthly Budget')

  // ── Emergency fund sheet ──────────────────────────────────
  const avgMonthlyExp = monthColumns.length
    ? monthColumns.reduce((s, m) => s + m.expenses.reduce((ss, e) => ss + toMonthly(e.amount, e.frequency), 0), 0) / monthColumns.length
    : 0
  const cumEmergency = monthColumns.reduce((s, m) => s + calcMonthlyIncome(m.income) * (m.savings.emergencyRate / 100), 0)
  const target = avgMonthlyExp * emergencyFundState.targetMonths
  const current = cumEmergency + (parseFloat(emergencyFundState.existingSavings) || 0)
  const covered = avgMonthlyExp > 0 ? current / avgMonthlyExp : 0

  const efRows = [
    ['Emergency Fund Tracker', ''],
    [''],
    ['Average monthly expenses (excl. savings)', fmt(avgMonthlyExp)],
    ['Target months', emergencyFundState.targetMonths],
    ['Target emergency fund', fmt(target)],
    ['Existing savings', fmt(parseFloat(emergencyFundState.existingSavings) || 0)],
    ['Cumulative emergency fund contributions', fmt(cumEmergency)],
    ['Current total', fmt(current)],
    ['Remaining to target', fmt(Math.max(0, target - current))],
    ['Months of expenses covered', fmt(covered)],
  ]
  const efWS = XLSX.utils.aoa_to_sheet(efRows)
  XLSX.utils.book_append_sheet(wb, efWS, 'Emergency Fund')

  XLSX.writeFile(wb, `HoxtonWealth_Budget_${dateStr()}.xlsx`)
}
