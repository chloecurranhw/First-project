import { useContext } from 'react'
import { CurrencyContext } from '../utils/CurrencyContext'

export default function LineItem({ item, onUpdate, dragHandleProps, isOverlay }) {
  const currencySymbol = useContext(CurrencyContext)
  return (
    <div className={`line-item${isOverlay ? ' line-item--overlay' : ''}`}>
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
