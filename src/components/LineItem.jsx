import { useContext } from 'react'
import { CurrencyContext } from '../utils/CurrencyContext'

function parseLabelPaste(text) {
  const trimmed = text.trim()
  const match = trimmed.match(/^(.+?)\s+[$£€¥₹]?(\d[\d,]*(?:\.\d{1,2})?)\s*$/)
  if (!match) return null
  const label = match[1].trim()
  const amount = match[2].replace(/,/g, '')
  const hasDecimal = amount.includes('.')
  const digitCount = amount.replace('.', '').length
  if (!label || (!hasDecimal && digitCount < 3)) return null
  return { label, amount }
}

export default function LineItem({ item, onUpdate, onRemoveIfEmpty, dragHandleProps, isOverlay }) {
  const currencySymbol = useContext(CurrencyContext)

  function handleLabelPaste(e) {
    const text = e.clipboardData.getData('text')
    const parsed = parseLabelPaste(text)
    if (!parsed) return
    e.preventDefault()
    onUpdate?.(parsed)
  }

  function handleBlur(e) {
    if (!e.currentTarget.contains(e.relatedTarget) && !item.label && !item.amount) {
      onRemoveIfEmpty?.()
    }
  }

  return (
    <div className={`line-item${isOverlay ? ' line-item--overlay' : ''}`} onBlur={handleBlur}>
      <span
        className="drag-handle"
        title="Drag to reorder"
        {...(dragHandleProps || {})}
      >
        ⠿
      </span>

      <input
        className="label-input"
        type="text"
        value={item.label}
        onChange={e => onUpdate?.('label', e.target.value)}
        onPaste={isOverlay ? undefined : handleLabelPaste}
        placeholder="Item name"
        readOnly={isOverlay}
      />

      <select
        className="frequency-select"
        value={item.frequency}
        onChange={e => onUpdate?.('frequency', e.target.value)}
        disabled={isOverlay}
      >
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="quarterly">Quarterly</option>
        <option value="annually">Annually</option>
      </select>

      <div className="amount-wrap">
        <span className="amount-prefix">{currencySymbol}</span>
        <input
          className="amount-input"
          type="number"
          value={item.amount}
          onChange={e => onUpdate?.('amount', e.target.value)}
          placeholder="0"
          min="0"
          readOnly={isOverlay}
        />
      </div>
    </div>
  )
}
