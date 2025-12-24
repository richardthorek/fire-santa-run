import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Waypoint } from '../types';
import { sortWaypoints } from '../utils/routeHelpers';

export interface WaypointListProps {
  waypoints: Waypoint[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onEdit?: (waypoint: Waypoint) => void;
  onDelete?: (waypointId: string) => void;
  editable?: boolean;
  className?: string;
}

interface SortableItemProps {
  waypoint: Waypoint;
  index: number;
  onEdit?: (waypoint: Waypoint) => void;
  onDelete?: (waypointId: string) => void;
  editable: boolean;
}

function SortableItem({ waypoint, index, onEdit, onDelete, editable }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: waypoint.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="waypoint-item"
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem',
        backgroundColor: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        marginBottom: '0.5rem',
        boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        {/* Drag Handle */}
        {editable && (
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: isDragging ? 'grabbing' : 'grab',
              padding: '0.5rem',
              color: '#9e9e9e',
              fontSize: '20px',
            }}
          >
            ⋮⋮
          </div>
        )}

        {/* Waypoint Number */}
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: waypoint.isCompleted ? '#43A047' : '#D32F2F',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '14px',
          flexShrink: 0,
        }}>
          {index + 1}
        </div>

        {/* Waypoint Details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
            {waypoint.name || `Waypoint ${index + 1}`}
          </div>
          {waypoint.address && (
            <div style={{ fontSize: '0.875rem', color: '#616161', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {waypoint.address}
            </div>
          )}
          {waypoint.notes && (
            <div style={{ fontSize: '0.875rem', color: '#9e9e9e', fontStyle: 'italic', marginTop: '0.25rem' }}>
              {waypoint.notes}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {editable && (
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            {onEdit && (
              <button
                onClick={() => onEdit(waypoint)}
                style={{
                  padding: '0.5rem',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '18px',
                }}
                title="Edit waypoint"
              >
                ✏️
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(waypoint.id)}
                style={{
                  padding: '0.5rem',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: '#d32f2f',
                }}
                title="Delete waypoint"
              >
                🗑️
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * WaypointList component with drag-and-drop reordering
 */
export function WaypointList({
  waypoints,
  onReorder,
  onEdit,
  onDelete,
  editable = true,
  className = '',
}: WaypointListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortedWaypoints = sortWaypoints(waypoints);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedWaypoints.findIndex(wp => wp.id === active.id);
      const newIndex = sortedWaypoints.findIndex(wp => wp.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(oldIndex, newIndex);
      }
    }
  };

  if (waypoints.length === 0) {
    return (
      <div className={className} style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#9e9e9e',
        border: '2px dashed #e0e0e0',
        borderRadius: '8px',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '1rem' }}>📍</div>
        <div style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          No waypoints yet
        </div>
        <div style={{ fontSize: '0.875rem' }}>
          Click on the map to add waypoints or search for addresses
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedWaypoints.map(wp => wp.id)}
          strategy={verticalListSortingStrategy}
        >
          {sortedWaypoints.map((waypoint, index) => (
            <SortableItem
              key={waypoint.id}
              waypoint={waypoint}
              index={index}
              onEdit={onEdit}
              onDelete={onDelete}
              editable={editable}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
