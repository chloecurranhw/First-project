import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import SortableLineItem from './SortableLineItem'

export default function Section({ items, category, columnId, onUpdateItem, onRemoveItem, onAddItem, overId }) {
  const droppableId = `${columnId}-${category}`
  const { setNodeRef, isOver } = useDroppable({ id: droppableId })

  const itemIds = items.map(i => i.id)

  return (
    <div className={`section${isOver && items.length === 0 ? ' section--over' : ''}`}>
      <h3 className="section-title">
        {category === 'needs' ? 'Needs' : 'Wants'}
      </h3>

      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="section-items">
          {items.map(item => (
            <SortableLineItem
              key={item.id}
              item={item}
              onUpdate={(fieldOrPatch, value) => onUpdateItem(item.id, fieldOrPatch, value)}
              onRemoveIfEmpty={() => onRemoveItem(item.id)}
              isDropTarget={overId === item.id}
            />
          ))}
          {items.length === 0 && (
            <div className="section-empty">No items yet</div>
          )}
        </div>
      </SortableContext>

      <button
        className="add-item-btn"
        onClick={() => onAddItem(category)}
      >
        + Add custom item
      </button>
    </div>
  )
}
