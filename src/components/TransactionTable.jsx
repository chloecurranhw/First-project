import { ALL_EXPENSE_CATEGORIES, calcMonthlyAverages, groupByCategory } from '../utils/transactionUtils'
import { useFmt } from '../utils/CurrencyContext'

export default function TransactionTable({ transactions, onUpdate, viewMode, onViewModeChange }) {
  const fmt = useFmt()
  const { averages, months, dateRange } = calcMonthlyAverages(transactions)
  const included = transactions.filter(t => t.included)

  function toggleAll(checked) {
    onUpdate(transactions.map(t => ({ ...t, included: checked })))
  }

  function toggle(id, checked) {
    onUpdate(transactions.map(t => t.id === id ? { ...t, included: checked } : t))
  }

  function setCategory(id, category) {
    onUpdate(transactions.map(t => t.id === id ? { ...t, category } : t))
  }

  const allChecked = transactions.every(t => t.included)

  return (
    <div className="txn-table-wrap">
      {/* Stats bar */}
      <div className="txn-stats">
        <span>
          <strong>{included.length}</strong> of {transactions.length} transactions selected
          {dateRange && (
            <span className="txn-date-range"> · {dateRange.first} → {dateRange.last}</span>
          )}
        </span>
        <div className="txn-view-toggle">
          <button
            className={`txn-view-btn${viewMode === 'all' ? ' txn-view-btn--active' : ''}`}
            onClick={() => onViewModeChange('all')}
          >
            All transactions
          </button>
          <button
            className={`txn-view-btn${viewMode === 'category' ? ' txn-view-btn--active' : ''}`}
            onClick={() => onViewModeChange('category')}
          >
            By category
          </button>
        </div>
      </div>

      {viewMode === 'all' ? (
        <div className="txn-list">
          <div className="txn-row txn-row--header">
            <input type="checkbox" checked={allChecked} onChange={e => toggleAll(e.target.checked)} />
            <span>Date</span>
            <span className="txn-desc-col">Description</span>
            <span>Amount</span>
            <span>Category</span>
          </div>
          <div className="txn-body">
            {transactions.map(t => (
              <div key={t.id} className={`txn-row${!t.included ? ' txn-row--excluded' : ''}`}>
                <input
                  type="checkbox"
                  checked={t.included}
                  onChange={e => toggle(t.id, e.target.checked)}
                />
                <span className="txn-date">{t.date}</span>
                <span className="txn-desc-col txn-desc">{t.description}</span>
                <span className="txn-amount">{fmt(t.amount)}</span>
                <select
                  className="txn-cat-select"
                  value={t.category}
                  onChange={e => setCategory(t.id, e.target.value)}
                >
                  {ALL_EXPENSE_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="txn-cat-view">
          {Object.entries(groupByCategory(transactions)).map(([cat, txns]) => {
            const total = txns.reduce((s, t) => s + t.amount, 0)
            const avg = averages[cat] || 0
            return (
              <div key={cat} className="txn-cat-group">
                <div className="txn-cat-group-header">
                  <span className="txn-cat-name">{cat}</span>
                  <span className="txn-cat-stats">
                    {txns.length} txn{txns.length !== 1 ? 's' : ''} · Total: {fmt(total)}
                    {months > 1 && <span> · Monthly avg: <strong>{fmt(avg)}</strong></span>}
                  </span>
                </div>
                {txns.map(t => (
                  <div key={t.id} className="txn-row txn-row--sub">
                    <input
                      type="checkbox"
                      checked={t.included}
                      onChange={e => toggle(t.id, e.target.checked)}
                    />
                    <span className="txn-date">{t.date}</span>
                    <span className="txn-desc-col txn-desc">{t.description}</span>
                    <span className="txn-amount">{fmt(t.amount)}</span>
                    <select
                      className="txn-cat-select"
                      value={t.category}
                      onChange={e => setCategory(t.id, e.target.value)}
                    >
                      {ALL_EXPENSE_CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )
          })}
          {Object.keys(groupByCategory(transactions)).length === 0 && (
            <p className="txn-empty">No transactions selected.</p>
          )}
        </div>
      )}
    </div>
  )
}
