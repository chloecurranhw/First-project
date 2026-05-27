import { useState } from 'react'
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import Section from './Section'
import LineItem from './LineItem'
import IncomeSection from './IncomeSection'
import SavingsRow from './SavingsRow'
import { generateId } from '../utils'
import { useFmt } from '../utils/CurrencyContext'
import { calcMonthlyIncome, calcMonthlyExpenses, calcSavingsAmount } from '../utils/monthUtils'

export default function MonthColumn({ month, onUpdate, onNameChange, onImport }) {
  const [dragState, setDragState] = useState(null)
  const [overId, setOverId] = useState(null)
  const fmt = useFmt()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const displayExpenses = dragState ? dragState.items : month.expenses
  const needsItems = displayExpenses.filter(i => i.category === 'needs')
  const wantsItems = displayExpenses.filter(i => i.category === 'wants')
  const activeItem = dragState ? displayExpenses.find(i => i.id === dragState.activeId) : null

  function getCategory(id, fromItems) {
    const item = fromItems.find(i => i.id === id)
    if (item) return item.category
    if (id === `${month.id}-needs`) return 'needs'
    if (id === `${month.id}-wants`) return 'wants'
    return null
  }

  function handleDragStart({ active }) {
    setDragState({ activeId: active.id, items: [...month.expenses] })
    setOverId(null)
  }

  function handleDragOver({ active, over }) {
    if (!over || active.id === over.id || !dragState) return
    setOverId(over.id)
    const current = dragState.items
    const ac = getCategory(active.id, current)
    const oc = getCategory(over.id, current)
    if (!ac || !oc || ac === oc) return
    setDragState(prev => {
      const ai = prev.items.findIndex(i => i.id === active.id)
      const oi = prev.items.findIndex(i => i.id === over.id)
      const updated = prev.items.map(i => i.id === active.id ? { ...i, category: oc } : i)
      return { ...prev, items: oi >= 0 ? arrayMove(updated, ai, oi) : updated }
    })
  }

  function handleDragEnd({ active, over }) {
    const final = dragState ? [...dragState.items] : [...month.expenses]
    setDragState(null)
    setOverId(null)
    if (!over || active.id === over.id) { onUpdate({ expenses: final }); return }
    const ac = getCategory(active.id, final)
    const oc = getCategory(over.id, final)
    if (ac === oc) {
      const ai = final.findIndex(i => i.id === active.id)
      const oi = final.findIndex(i => i.id === over.id)
      if (ai !== oi && oi >= 0) { onUpdate({ expenses: arrayMove(final, ai, oi) }); return }
    }
    onUpdate({ expenses: final })
  }

  function updateExpenseItem(id, fieldOrPatch, value) {
    const patch = typeof fieldOrPatch === 'object' ? fieldOrPatch : { [fieldOrPatch]: value }
    onUpdate({ expenses: month.expenses.map(i => i.id === id ? { ...i, ...patch } : i) })
  }

  function addExpenseItem(category) {
    onUpdate({
      expenses: [...month.expenses, { id: generateId(), label: '', category, frequency: 'monthly', amount: '' }],
    })
  }

  function removeExpenseItem(id) {
    onUpdate({ expenses: month.expenses.filter(i => i.id !== id) })
  }

  const monthlyIncome   = calcMonthlyIncome(month.income)
  const monthlyExpenses = calcMonthlyExpenses(month.expenses)
  const savingsAmt      = calcSavingsAmount(month.savings, monthlyIncome)
  const totalExpenses   = monthlyExpenses + savingsAmt
  const surplus         = monthlyIncome - totalExpenses

  return (
    <div className="month-col">
      {/* Month name */}
      <div className="month-col-header">
        <input
          className="month-name-input"
          value={month.name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Month name"
        />
      </div>

      {/* Income */}
      <IncomeSection
        items={month.income}
        monthId={month.id}
        onItemsChange={income => onUpdate({ income })}
      />

      {/* Expenses */}
      <div className="month-expenses-area">
        <div className="expenses-header-row">
          <h3 className="section-title section-title--expenses" style={{ margin: 0 }}>Expenses</h3>
          {onImport && (
            <button className="import-btn" onClick={onImport} title="Import transactions from file">
              ↑ Import
            </button>
          )}
        </div>

        {/* Savings — fixed above DnD context */}
        <SavingsRow
          savings={month.savings}
          monthlyIncome={monthlyIncome}
          onChange={savings => onUpdate({ savings })}
        />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <Section
            items={needsItems}
            category="needs"
            columnId={month.id}
            onUpdateItem={updateExpenseItem}
            onRemoveItem={removeExpenseItem}
            onAddItem={addExpenseItem}
            overId={overId}
          />
          <Section
            items={wantsItems}
            category="wants"
            columnId={month.id}
            onUpdateItem={updateExpenseItem}
            onRemoveItem={removeExpenseItem}
            onAddItem={addExpenseItem}
            overId={overId}
          />
          <DragOverlay dropAnimation={null}>
            {activeItem && (
              <div className="drag-overlay-item">
                <LineItem item={activeItem} isOverlay />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Month summary */}
      <div className="month-summary">
        <div className="month-summary-row">
          <span>Total income</span>
          <span className="total-amount">{fmt(monthlyIncome)}</span>
        </div>
        <div className="month-summary-row">
          <span>Total expenses</span>
          <span className="total-amount">{fmt(totalExpenses)}</span>
        </div>
        <div className={`month-surplus ${surplus >= 0 ? 'month-surplus--pos' : 'month-surplus--neg'}`}>
          <span>{surplus >= 0 ? 'Surplus' : 'Deficit'}</span>
          <span className="total-amount">{fmt(Math.abs(surplus))}</span>
        </div>
      </div>
    </div>
  )
}
