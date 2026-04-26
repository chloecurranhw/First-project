export const CATEGORY_KEYWORDS = {
  'Food & groceries': ['CARREFOUR', 'WAITROSE', 'TESCO', 'SAINSBURY', 'SPINNEYS', 'ASDA', 'LIDL', 'ALDI', 'MORRISONS', 'MARKS SPENCER', 'MARKS & SPENCER', 'WHOLE FOODS', 'AMAZON FRESH'],
  'Dining out':       ['DELIVEROO', 'UBER EATS', 'TALABAT', 'ZOMATO', 'STARBUCKS', 'COSTA', 'MCDONALD', 'SUBWAY'],
  'Subscriptions':    ['NETFLIX', 'SPOTIFY', 'APPLE.COM', 'APPLE/ITUNES', 'AMAZON PRIME', 'DISNEY', 'OSN', 'YOUTUBE'],
  'Transport':        ['CAREEM', 'BOLT', 'TFL', 'SALIK', 'RTA', 'PETROL', 'BP ', 'SHELL', 'ADNOC'],
  'Utilities':        ['DEWA', 'SEWA', 'FEWA', 'BRITISH GAS', 'EDF', 'THAMES WATER', 'VIRGIN MEDIA', 'ETISALAT', 'DU TELECOM'],
  'Housing / rent':   ['RENT', 'MORTGAGE', 'PROPERTY'],
  'Healthcare':       ['PHARMACY', 'BOOTS PHARMACY', 'LIFE PHARMACY', 'CLINIC', 'HOSPITAL', 'DENTIST', 'DOCTOR'],
  'Insurance':        ['INSURANCE', 'AXA', 'BUPA', 'DAMAN', 'ALLIANZ'],
  'Travel':           ['EMIRATES', 'FLYDUBAI', 'BRITISH AIRWAYS', 'HOTEL', 'BOOKING.COM', 'AIRBNB', 'EXPEDIA'],
}

// 'UBER' alone covers Transport, but 'UBER EATS' is Dining out — order matters
const ORDERED_KEYWORDS = [
  ['UBER EATS',      'Dining out'],
  ['AMAZON FRESH',   'Food & groceries'],
  ['AMAZON PRIME',   'Subscriptions'],
  ...Object.entries(CATEGORY_KEYWORDS).flatMap(([cat, kws]) => kws.map(kw => [kw, cat])),
  ['UBER',           'Transport'],
  ['AMAZON',         'Subscriptions'],
  ['APPLE',          'Subscriptions'],
]

export const ALL_EXPENSE_CATEGORIES = [
  'Food & groceries', 'Dining out', 'Transport', 'Utilities',
  'Housing / rent', 'Healthcare', 'Insurance', 'Travel',
  'Subscriptions', 'Clothing', 'Hobbies', 'Gifts', 'Other',
]

export const NEEDS_CATEGORIES = new Set([
  'Food & groceries', 'Utilities', 'Housing / rent', 'Healthcare', 'Insurance', 'Transport',
])

export function categorize(description) {
  const upper = (description || '').toUpperCase()
  for (const [kw, cat] of ORDERED_KEYWORDS) {
    if (upper.includes(kw)) return cat
  }
  return 'Other'
}

export function parseAmount(val) {
  if (val == null || val === '') return 0
  const str = String(val)
    .replace(/[£$€\s]/g, '')
    .replace(/^\((-?\d)/, '-$1').replace(/\)$/, '')
    .replace(/,/g, '')
  const n = parseFloat(str)
  return isNaN(n) ? 0 : n
}

export function parseDate(val) {
  if (!val) return ''
  const s = String(val).trim()
  // ISO already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
  if (dmy) {
    const y = dmy[3].length === 2 ? '20' + dmy[3] : dmy[3]
    const m = dmy[2].padStart(2, '0')
    const d = dmy[1].padStart(2, '0')
    const parsed = new Date(`${y}-${m}-${d}`)
    if (!isNaN(parsed)) return `${y}-${m}-${d}`
  }
  // JS default parse (handles Month DD YYYY, etc.)
  const fallback = new Date(s)
  if (!isNaN(fallback)) return fallback.toISOString().slice(0, 10)
  return s
}

const isDateLike  = v => /\d{1,4}[-\/\.]\d{1,2}[-\/\.]\d{1,4}/.test(String(v).trim()) || !isNaN(Date.parse(String(v).trim()))
const isNumeric   = v => /^-?[\d,£$€]+\.?\d*$/.test(String(v).trim().replace(/[£$€, ]/g, ''))
const isTextLike  = v => { const s = String(v).trim(); return s.length > 2 && isNaN(s.replace(/[£$€,. ]/g, '')) }

export function detectColumns(headers, sampleRows) {
  if (!headers.length || !sampleRows.length) return null

  const score = (col, fn) => {
    const vals = sampleRows.map(r => r[col])
    return vals.filter(fn).length / vals.length
  }

  const info = headers.map(h => ({
    h,
    date:   score(h, isDateLike),
    num:    score(h, isNumeric),
    text:   score(h, isTextLike),
  }))

  const byDate   = [...info].sort((a, b) => b.date - a.date)
  const byNum    = [...info].sort((a, b) => b.num  - a.num)
  const byText   = [...info].sort((a, b) => b.text - a.text)

  const dateCol = byDate[0]?.date > 0.4 ? byDate[0].h : null

  // Detect if there are separate debit/credit columns
  const numCols = info.filter(c => c.num > 0.3 && c.h !== dateCol)
  const amountCol  = numCols[0]?.h ?? null
  const amount2Col = numCols[1]?.h ?? null   // may be credit col

  const descCol = byText
    .filter(c => c.h !== dateCol && c.h !== amountCol && c.h !== amount2Col)
    [0]?.text > 0.3 ? byText.filter(c => c.h !== dateCol && c.h !== amountCol && c.h !== amount2Col)[0].h : null

  const confident = !!(dateCol && amountCol && descCol &&
    byDate[0].date > 0.6 && byNum[0].num > 0.5 && byText[0].text > 0.5)

  return { dateCol, descCol, amountCol, amount2Col, confident }
}

export function buildTransactions(rows, mapping) {
  const { dateCol, descCol, amountCol, amount2Col } = mapping
  const txns = []

  for (const row of rows) {
    const rawAmt = parseAmount(row[amountCol])
    // For debit/credit split columns: use amount2Col as credit, amountCol as debit
    let amt = rawAmt
    if (amount2Col) {
      const credit = parseAmount(row[amount2Col])
      // If credit column has value and debit is empty/zero → it's a credit, skip
      if (credit > 0 && rawAmt === 0) continue
      if (rawAmt === 0 && credit === 0) continue
      amt = rawAmt || credit
    }

    // Skip credits (negative amounts in a single-column setup)
    if (amt < 0) continue
    if (amt === 0) continue

    const desc = String(row[descCol] || '').trim()
    if (!desc) continue

    txns.push({
      id: Math.random().toString(36).slice(2),
      date: parseDate(row[dateCol]),
      description: desc,
      amount: Math.abs(amt),
      category: categorize(desc),
      included: true,
    })
  }

  return txns
}

export function calcMonthlyAverages(transactions) {
  const included = transactions.filter(t => t.included)
  if (!included.length) return { averages: {}, months: 1, dateRange: null }

  const dates = included.map(t => t.date).filter(Boolean).sort()
  const first = new Date(dates[0])
  const last  = new Date(dates[dates.length - 1])
  const months = Math.max(1,
    (last.getFullYear() - first.getFullYear()) * 12 +
    (last.getMonth() - first.getMonth()) + 1
  )

  const totals = {}
  for (const t of included) {
    totals[t.category] = (totals[t.category] || 0) + t.amount
  }

  return {
    averages: Object.fromEntries(Object.entries(totals).map(([c, v]) => [c, v / months])),
    months,
    dateRange: { first: dates[0], last: dates[dates.length - 1] },
  }
}

export function groupByCategory(transactions) {
  const groups = {}
  for (const t of transactions.filter(t => t.included)) {
    if (!groups[t.category]) groups[t.category] = []
    groups[t.category].push(t)
  }
  return groups
}
