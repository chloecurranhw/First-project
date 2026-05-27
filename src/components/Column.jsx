import { useState, useContext } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import Section from './Section'
import LineItem from './LineItem'
import Banner from './Banner'
import { toAnnual, generateId } from '../utils'
import { CurrencyContext, useFmt } from '../utils/CurrencyContext'

export default function Column({
  columnId,
  title,
  subtitle,
  items,
  onItemsChange,
  oneOffEvents = [],
  onOneOffEventsChange,
  copyButton,
  banner,
  onDismissBanner,
  tip,
}) {
  const [dragState, setDragState] = useState(null)
  const [overId, setOverId] = useState(null)
  const fmt = useFmt()
  const currencySymbol = useContext(CurrencyContext)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const displayItems = dragState ? dragState.items : items
  const needsItems = displayItems.filter(i => i.category === 'needs')
  const wantsItems = displayItems.filter(i => i.category === 'wants')
  const activeItem = dragState ? displayItems.find(i => i.id === dragState.activeId) : null

  function getCategory(id, fromItems) {
    const item = fromItems.find(i => i.id === id)
    if (item) return item.category
    if (id === `${columnId}-needs`) return 'needs'
    if (id === `${columnId}-wants`) return 'wants'
    return null
  }

  function handleDragStart({ active }) {
    setDragState({ activeId: active.id, items: [...items] })
    setOverId(null)
  }

  function handleDragOver({ active, over }) {
    if (!over || active.id === over.id || !dragState) return

    setOverId(over.id)

    const current = dragState.items
    const activeCategory = getCategory(active.id, current)
    const overCategory = getCategory(over.id, current)

    if (!activeCategory || !overCategory || activeCategory === overCategory) return

    // Cross-section: update category and reposition
    setDragState(prev => {
      const prev_items = prev.items
      const activeIndex = prev_items.findIndex(i => i.id === active.id)
      const overIndex = prev_items.findIndex(i => i.id === over.id)

      const updated = prev_items.map(i =>
        i.id === active.id ? { ...i, category: overCategory } : i
      )

      if (overIndex >= 0) {
        return { ...prev, items: arrayMove(updated, activeIndex, overIndex) }
      }
      return { ...prev, items: updated }
    })
  }

  function handleDragEnd({ active, over }) {
    const finalItems = dragState ? [...dragState.items] : [...items]
    setDragState(null)
    setOverId(null)

    if (!over || active.id === over.id) {
      onItemsChange(columnId, finalItems)
      return
    }

    const activeCategory = getCategory(active.id, finalItems)
    const overCategory = getCategory(over.id, finalItems)

    if (activeCategory === overCategory) {
      const activeIndex = finalItems.findIndex(i => i.id === active.id)
      const overIndex = finalItems.findIndex(i => i.id === over.id)
      if (activeIndex !== overIndex && overIndex >= 0) {
        const reordered = arrayMove(finalItems, activeIndex, overIndex)
        onItemsChange(columnId, reordered)
        return
      }
    }

    onItemsChange(columnId, finalItems)
  }

  function handleUpdateItem(id, field, value) {
    const updated = items.map(i => i.id === id ? { ...i, [field]: value } : i)
    onItemsChange(columnId, updated)
  }

  function handleRemoveItem(id) {
    onItemsChange(columnId, items.filter(i => i.id !== id))
  }

  function handleAddItem(category) {
    const newItem = {
      id: generateId(),
      label: '',
      category,
      type: null,
      frequency: 'monthly',
      amount: '',
    }
    onItemsChange(columnId, [...items, newItem])
  }

  const needsTotal = needsItems.reduce((s, i) => s + toAnnual(i.amount, i.frequency), 0)
  const wantsTotal = wantsItems.reduce((s, i) => s + toAnnual(i.amount, i.frequency), 0)
  const grandTotal = needsTotal + wantsTotal
  const oneOffTotal = oneOffEvents.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)

  function addOneOffEvent() {
    onOneOffEventsChange(columnId, [
      ...oneOffEvents,
      { id: generateId(), label: '', age: '', amount: '' },
    ])
  }

  function updateOneOffEvent(id, field, value) {
    onOneOffEventsChange(columnId, oneOffEvents.map(e => e.id === id ? { ...e, [field]: value } : e))
  }

  function deleteOneOffEvent(id) {
    onOneOffEventsChange(columnId, oneOffEvents.filter(e => e.id !== id))
  }

  return (
    <div className="column">
      <div className="column-header">
        <h2 className="column-title">{title}</h2>
        {subtitle && <p className="column-subtitle">{subtitle}</p>}
      </div>

      {banner && !banner.dismissed && (
        <Banner banner={banner} onDismiss={onDismissBanner} />
      )}

      {tip && (
        <div className="column-tip">
          <span className="column-tip-text">{tip.message}</span>
          {tip.action && (
            <button className="column-tip-btn" onClick={tip.action.onClick}>
              {tip.action.label}
            </button>
          )}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="column-body">
          <Section
            items={needsItems}
            category="needs"
            columnId={columnId}
            onUpdateItem={handleUpdateItem}
            onRemoveItem={handleRemoveItem}
            onAddItem={handleAddItem}
            overId={overId}
          />
          <Section
            items={wantsItems}
            category="wants"
            columnId={columnId}
            onUpdateItem={handleUpdateItem}
            onRemoveItem={handleRemoveItem}
            onAddItem={handleAddItem}
            overId={overId}
          />
        </div>

        <DragOverlay dropAnimation={null}>
          {activeItem && (
            <div className="drag-overlay-item">
              <LineItem item={activeItem} isOverlay />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <div className="one-off-section">
        <h3 className="one-off-title">One-off costs</h3>
        {oneOffEvents.map(event => (
          <div key={event.id} className="one-off-row">
            <input
              className="one-off-input one-off-input--label"
              type="text"
              placeholder="Description"
              value={event.label}
              onChange={e => updateOneOffEvent(event.id, 'label', e.target.value)}
            />
            <label className="one-off-age-label">Age</label>
            <input
              className="one-off-input one-off-input--age"
              type="number"
              min="0"
              max="120"
              placeholder="—"
              value={event.age}
              onChange={e => updateOneOffEvent(event.id, 'age', e.target.value)}
            />
            <span className="one-off-currency">{currencySymbol}</span>
            <input
              className="one-off-input one-off-input--amount"
              type="number"
              min="0"
              placeholder="0"
              value={event.amount}
              onChange={e => updateOneOffEvent(event.id, 'amount', e.target.value)}
            />
            <button className="one-off-delete" onClick={() => deleteOneOffEvent(event.id)} title="Remove">×</button>
          </div>
        ))}
        <button className="one-off-add" onClick={addOneOffEvent}>+ Add event</button>
      </div>

      <div className="column-totals">
        <div className="total-row">
          <span>Needs</span>
          <span className="total-amount">{fmt(needsTotal)}</span>
        </div>
        <div className="total-row">
          <span>Wants</span>
          <span className="total-amount">{fmt(wantsTotal)}</span>
        </div>
        <div className="total-row total-row--grand">
          <span>Annual total</span>
          <span className="total-amount">{fmt(grandTotal)}</span>
        </div>
        {oneOffTotal > 0 && (
          <div className="total-row total-row--oneoff">
            <span>One-off events total</span>
            <span className="total-amount">{fmt(oneOffTotal)}</span>
          </div>
        )}
      </div>

      {copyButton && (
        <div className="copy-btn-wrap">
          <button className="copy-btn" onClick={copyButton.onClick}>
            {copyButton.label}
          </button>
        </div>
      )}
    </div>
  )
}
