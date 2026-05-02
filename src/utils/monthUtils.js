import { generateId } from '../utils'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function suggestNextName(name) {
  if (!name?.trim()) return null
  const t = name.trim()

  const mIdx = MONTH_NAMES.findIndex(m => m.toLowerCase() === t.toLowerCase())
  if (mIdx >= 0) return MONTH_NAMES[(mIdx + 1) % 12]

  const sIdx = SHORT_MONTHS.findIndex(m => m.toLowerCase() === t.toLowerCase())
  if (sIdx >= 0) return SHORT_MONTHS[(sIdx + 1) % 12]

  const q = t.match(/^(Q|Quarter\s*)(\d+)$/i)
  if (q) return `${q[1]}${parseInt(q[2]) + 1}`

  const n = t.match(/^(.*?)(\s*)(\d+)$/)
  if (n) return `${n[1]}${n[2]}${parseInt(n[3]) + 1}`

  return null
}

export function createDefaultIncomeItems() {
  return [
    { id: generateId(), label: 'Salary / wages', frequency: 'monthly', amount: '' },
    { id: generateId(), label: 'Rental income',  frequency: 'monthly', amount: '' },
    { id: generateId(), label: 'Other income',   frequency: 'monthly', amount: '' },
  ]
}

export function createDefaultExpenseItems() {
  return [
    { id: generateId(), label: 'Housing / rent',   category: 'needs', frequency: 'monthly',  amount: '' },
    { id: generateId(), label: 'Utilities',         category: 'needs', frequency: 'monthly',  amount: '' },
    { id: generateId(), label: 'Food & groceries',  category: 'needs', frequency: 'monthly',  amount: '' },
    { id: generateId(), label: 'Healthcare',        category: 'needs', frequency: 'monthly',  amount: '' },
    { id: generateId(), label: 'Insurance',         category: 'needs', frequency: 'monthly',  amount: '' },
    { id: generateId(), label: 'Transport',         category: 'needs', frequency: 'monthly',  amount: '' },
    { id: generateId(), label: 'Travel',            category: 'wants', frequency: 'annually', amount: '' },
    { id: generateId(), label: 'Dining out',        category: 'wants', frequency: 'monthly',  amount: '' },
    { id: generateId(), label: 'Hobbies',           category: 'wants', frequency: 'monthly',  amount: '' },
    { id: generateId(), label: 'Gifts',             category: 'wants', frequency: 'annually', amount: '' },
    { id: generateId(), label: 'Clothing',          category: 'wants', frequency: 'annually', amount: '' },
    { id: generateId(), label: 'Subscriptions',     category: 'wants', frequency: 'monthly',  amount: '' },
  ]
}

export function createMonth(name, savingsDefaults = { totalRate: 20, longTermRate: 10, emergencyRate: 10 }) {
  return {
    id: generateId(),
    name,
    income: createDefaultIncomeItems(),
    expenses: createDefaultExpenseItems(),
    savings: {
      totalRate: savingsDefaults.totalRate,
      longTermRate: savingsDefaults.longTermRate,
      emergencyRate: savingsDefaults.emergencyRate,
      expanded: false,
    },
  }
}

export function createDefaultMonths(count, savingsDefaults) {
  const months = []
  let name = 'Month 1'
  for (let i = 0; i < count; i++) {
    months.push(createMonth(name, savingsDefaults))
    name = suggestNextName(name) || `Month ${i + 2}`
  }
  return months
}

export function toMonthly(amount, frequency) {
  const amt = parseFloat(amount) || 0
  if (frequency === 'weekly')    return (amt * 52) / 12
  if (frequency === 'quarterly') return amt / 3
  if (frequency === 'annually')  return amt / 12
  return amt
}

export function calcMonthlyIncome(incomeItems) {
  return incomeItems.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0)
}

export function calcMonthlyExpenses(expenseItems) {
  return expenseItems.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0)
}

export function calcSavingsAmount(savings, monthlyIncome) {
  return monthlyIncome * (savings.totalRate / 100)
}

export function redistributeSavings(savings, changedField, rawValue) {
  const val = parseFloat(rawValue) || 0
  if (changedField === 'totalRate') {
    const oldSum = savings.longTermRate + savings.emergencyRate
    if (oldSum === 0) {
      return { ...savings, totalRate: val, longTermRate: val / 2, emergencyRate: val / 2 }
    }
    const newLong = Math.round((savings.longTermRate / oldSum) * val * 10) / 10
    return { ...savings, totalRate: val, longTermRate: newLong, emergencyRate: Math.round((val - newLong) * 10) / 10 }
  }
  if (changedField === 'longTermRate') {
    return { ...savings, longTermRate: val, emergencyRate: Math.round((savings.totalRate - val) * 10) / 10 }
  }
  if (changedField === 'emergencyRate') {
    return { ...savings, emergencyRate: val, longTermRate: Math.round((savings.totalRate - val) * 10) / 10 }
  }
  return savings
}
