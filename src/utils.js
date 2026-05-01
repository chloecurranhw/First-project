export function toAnnual(amount, frequency) {
  const amt = parseFloat(amount) || 0
  if (frequency === 'weekly')    return amt * 52
  if (frequency === 'monthly')   return amt * 12
  if (frequency === 'quarterly') return amt * 4
  return amt
}

export function formatCurrency(amount) {
  if (!amount || amount === 0) return '—'
  return '$' + new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount))
}

export function generateId() {
  return crypto.randomUUID()
}

export function createDefaultItems() {
  return [
    { id: generateId(), label: 'Housing costs',    category: 'needs', type: null,         frequency: 'monthly',   amount: '' },
    { id: generateId(), label: 'Utilities',         category: 'needs', type: null,         frequency: 'monthly',   amount: '' },
    { id: generateId(), label: 'Food & groceries',  category: 'needs', type: null,         frequency: 'monthly',   amount: '' },
    { id: generateId(), label: 'Healthcare',        category: 'needs', type: 'healthcare', frequency: 'monthly',   amount: '' },
    { id: generateId(), label: 'Insurance',         category: 'needs', type: null,         frequency: 'monthly',   amount: '' },
    { id: generateId(), label: 'Transport',         category: 'needs', type: null,         frequency: 'monthly',   amount: '' },
    { id: generateId(), label: 'Travel',            category: 'wants', type: 'travel',     frequency: 'annually',  amount: '' },
    { id: generateId(), label: 'Dining out',        category: 'wants', type: null,         frequency: 'monthly',   amount: '' },
    { id: generateId(), label: 'Hobbies',           category: 'wants', type: null,         frequency: 'monthly',   amount: '' },
    { id: generateId(), label: 'Gifts',             category: 'wants', type: null,         frequency: 'annually',  amount: '' },
    { id: generateId(), label: 'Clothing',          category: 'wants', type: null,         frequency: 'annually',  amount: '' },
    { id: generateId(), label: 'Subscriptions',     category: 'wants', type: null,         frequency: 'monthly',   amount: '' },
  ]
}
