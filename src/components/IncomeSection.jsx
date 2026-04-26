import { generateId } from '../utils'
import { toMonthly } from '../utils/monthUtils'
import { useFmt } from '../utils/CurrencyContext'

export default function IncomeSection({ items, monthId, onItemsChange }) {
  const fmt = useFmt()
  function update(id, field, value) {
    onItemsChange(items.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  function addItem() {
    onItemsChange([...items, { id: generateId(), label: '', frequency: 'monthly', amount: '' }])
  }

  const total = items.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0)

  return (
    <div className="income-section">
      <h3 className="section-title">Income</h3>

      {items.map(item => (
        <div key={item.id} className="line-item line-item--income">
          <input
            className="label-input"
            value={item.label}
            onChange={e => update(item.id, 'label', e.target.value)}
            placeholder="Income source"
          />
          <select
            className="frequency-select"
            value={item.frequency}
            onChange={e => update(item.id, 'frequency', e.target.value)}
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="annually">Annually</option>
          </select>
          <div className="amount-wrap">
            <span className="amount-prefix">$</span>
            <input
              className="amount-input"
              type="number"
              min="0"
              value={item.amount}
              onChange={e => update(item.id, 'amount', e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
      ))}

      <button className="add-item-btn" onClick={addItem}>+ Add income row</button>

      <div className="income-total">
        <span>Monthly income</span>
        <span className="total-amount">{fmt(total)}</span>
      </div>
    </div>
  )
}
