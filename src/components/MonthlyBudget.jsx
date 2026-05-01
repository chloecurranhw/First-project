import { useState } from 'react'
import MonthColumn from './MonthColumn'
import TotalsColumn from './TotalsColumn'
import EmergencyFundTracker from './EmergencyFundTracker'
import ExportMenu from './ExportMenu'
import ConfirmDialog from './ConfirmDialog'
import ImportPanel from './ImportPanel'
import { suggestNextName, createMonth } from '../utils/monthUtils'
import { toAnnual, generateId } from '../utils'

export default function MonthlyBudget({
  monthCount, onMonthCountChange,
  monthColumns, onMonthColumnsChange,
  emergencyFundState, onEmergencyFundChange,
  savingsDefaults,
  onCopyToRetirement,
  onSwitchToRetirement,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importTargetIdx, setImportTargetIdx] = useState(0)

  function handleMonthCountChange(newCount) {
    const n = Math.max(1, Math.min(12, parseInt(newCount) || 1))
    onMonthCountChange(n)
    onMonthColumnsChange(prev => {
      if (n > prev.length) {
        const added = []
        for (let i = prev.length; i < n; i++) {
          const lastName = prev[i - 1]?.name || `Month ${i}`
          const nextName = suggestNextName(lastName) || `Month ${i + 1}`
          added.push(createMonth(nextName, savingsDefaults))
        }
        return [...prev, ...added]
      }
      return prev.slice(0, n)
    })
  }

  function handleMonthUpdate(idx, patch) {
    onMonthColumnsChange(prev => prev.map((m, i) => i === idx ? { ...m, ...patch } : m))
  }

  function handleNameChange(idx, name) {
    onMonthColumnsChange(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], name }
      let cur = name
      for (let i = idx + 1; i < updated.length; i++) {
        const next = suggestNextName(cur)
        if (!next) break
        updated[i] = { ...updated[i], name: next }
        cur = next
      }
      return updated
    })
  }

  function openImport(idx) {
    setImportTargetIdx(idx)
    setImportOpen(true)
  }

  function doCopy() {
    setConfirmOpen(false)
    const source = monthColumns[0]
    if (!source) return
    const annualItems = source.expenses.map(item => ({
      id: generateId(),
      label: item.label,
      category: item.category,
      type: null,
      frequency: 'annually',
      amount: String(Math.round(toAnnual(item.amount, item.frequency))),
    }))
    onCopyToRetirement(annualItems)
    onSwitchToRetirement()
  }

  return (
    <div className="monthly-budget">
      {/* Toolbar */}
      <div className="mb-toolbar">
        <div className="mb-toolbar-left">
          <label className="mb-month-count-label">
            How many months do you want to plan?
            <select
              className="mb-month-count-select"
              value={monthCount}
              onChange={e => handleMonthCountChange(e.target.value)}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mb-toolbar-right">
          <button className="copy-to-ret-btn" onClick={() => setConfirmOpen(true)}>
            Copy to current lifestyle →
          </button>
          <ExportMenu monthColumns={monthColumns} emergencyFundState={emergencyFundState} />
        </div>
      </div>

      {/* Month columns + totals */}
      <div className="mb-scroll-area">
        <div className="mb-columns-wrap">
          {monthColumns.map((month, idx) => (
            <MonthColumn
              key={month.id}
              month={month}
              onUpdate={patch => handleMonthUpdate(idx, patch)}
              onNameChange={name => handleNameChange(idx, name)}
              onImport={() => openImport(idx)}
            />
          ))}
          <TotalsColumn monthColumns={monthColumns} />
        </div>
      </div>

      {/* Emergency fund tracker */}
      <EmergencyFundTracker
        monthColumns={monthColumns}
        state={emergencyFundState}
        onChange={onEmergencyFundChange}
      />

      {confirmOpen && (
        <ConfirmDialog
          title="Copy to current lifestyle?"
          message="This will overwrite all items in the retirement planner's Current lifestyle column with your monthly budget expenses (from the first month), converted to annual figures. Income and savings rows will not be copied."
          onConfirm={doCopy}
          onCancel={() => setConfirmOpen(false)}
        />
      )}

      {importOpen && (
        <ImportPanel
          onClose={() => setImportOpen(false)}
          monthColumns={monthColumns}
          onMonthColumnsChange={onMonthColumnsChange}
          defaultTargetIdx={importTargetIdx}
        />
      )}
    </div>
  )
}
