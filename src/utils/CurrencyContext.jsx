import { createContext, useContext } from 'react'

export const CURRENCIES = [
  { code: 'USD', symbol: '$',    label: 'USD ($)' },
  { code: 'GBP', symbol: '£',    label: 'GBP (£)' },
  { code: 'EUR', symbol: '€',    label: 'EUR (€)' },
  { code: 'AUD', symbol: 'A$',   label: 'AUD (A$)' },
  { code: 'AED', symbol: 'د.إ ', label: 'AED (د.إ)' },
]

export const CurrencyContext = createContext('$')

export function useFmt() {
  const symbol = useContext(CurrencyContext)
  return (amount) => {
    if (!amount || amount === 0) return '—'
    return symbol + new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(amount))
  }
}
