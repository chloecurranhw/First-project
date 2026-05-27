import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import LineItem from './LineItem'

export default function SortableLineItem({ item, onUpdate, onRemoveIfEmpty, isDropTarget }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'sortable-item',
        isDragging     ? 'sortable-item--dragging'    : '',
        isDropTarget   ? 'sortable-item--drop-target' : '',
      ].filter(Boolean).join(' ')}
    >
      <LineItem
        item={item}
        onUpdate={onUpdate}
        onRemoveIfEmpty={onRemoveIfEmpty}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}
