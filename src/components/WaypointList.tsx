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
import { formatETA } from '../utils/navigation';

export interface WaypointListProps {
  waypoints: Waypoint[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onEdit?: (waypoint: Waypoint) => void;
  onDelete?: (waypointId: string) => void;
  editable?: boolean;
  showETA?: boolean; // New prop to control ETA display
  className?: string;
}

interface SortableItemProps {
  waypoint: Waypoint;
  /** The stop before this one in route order (for leg-time display), if any. */
  previous?: Waypoint;
  index: number;
  onEdit?: (waypoint: Waypoint) => void;
  onDelete?: (waypointId: string) => void;
  editable: boolean;
  showETA: boolean; // Add showETA prop
}

/** Standard six-dot drag grip — one unambiguous handle instead of split dots. */
function DragGrip() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true" focusable="false">
      {[2, 8].map((cx) =>
        [2, 8, 14].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" fill="currentColor" />),
      )}
    </svg>
  );
}

/** "+4 min" travel time for the leg into this stop, from consecutive ETAs. */
function legMinutes(waypoint: Waypoint, previous?: Waypoint): number | null {
  if (!previous?.estimatedArrival || !waypoint.estimatedArrival) return null;
  const from = Date.parse(previous.estimatedArrival);
  const to = Date.parse(waypoint.estimatedArrival);
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return null;
  return Math.max(1, Math.round((to - from) / 60_000));
}

function SortableItem({ waypoint, previous, index, onEdit, onDelete, editable, showETA }: SortableItemProps) {
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

  const name = waypoint.name || `Waypoint ${index + 1}`;
  const leg = showETA ? legMinutes(waypoint, previous) : null;
  const eta = showETA && waypoint.estimatedArrival ? formatETA(new Date(waypoint.estimatedArrival)) : null;

  // Secondary line: planning data when available, otherwise the address.
  const secondary = eta
    ? `${eta}${leg !== null ? ` · +${leg} min` : ''}${waypoint.address ? ` · ${waypoint.address}` : ''}`
    : waypoint.address || '';

  return (
    <div ref={setNodeRef} style={style} className="waypoint-item">
      <div
        title={waypoint.address ? `${name} — ${waypoint.address}` : name}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.45rem 0.5rem',
          backgroundColor: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          marginBottom: '0.35rem',
          boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.06)',
        }}
      >
        {/* Drag Handle */}
        {editable && (
          <div
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${name}`}
            style={{
              cursor: isDragging ? 'grabbing' : 'grab',
              padding: '0.4rem 0.25rem',
              color: '#9e9e9e',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              touchAction: 'none',
            }}
          >
            <DragGrip />
          </div>
        )}

        {/* Waypoint Number */}
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: waypoint.isCompleted ? '#43A047' : '#D32F2F',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '12px',
            flexShrink: 0,
          }}
        >
          {index + 1}
        </div>

        {/* Waypoint Details — compact two-line block, both lines truncate */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: '0.875rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </div>
          {secondary && (
            <div
              style={{
                fontSize: '0.75rem',
                color: eta ? '#0277BD' : '#757575',
                fontWeight: eta ? 600 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {secondary}
            </div>
          )}
          {waypoint.notes && (
            <div
              style={{
                fontSize: '0.75rem',
                color: '#9e9e9e',
                fontStyle: 'italic',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {waypoint.notes}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {editable && (
          <div style={{ display: 'flex', gap: '0.125rem', flexShrink: 0 }}>
            {onEdit && (
              <button
                onClick={() => onEdit(waypoint)}
                aria-label={`Edit ${name}`}
                title="Edit waypoint"
                style={{
                  width: '28px',
                  height: '28px',
                  padding: 0,
                  border: 'none',
                  borderRadius: '6px',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  lineHeight: 1,
                }}
              >
                ✏️
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(waypoint.id)}
                aria-label={`Delete ${name}`}
                title="Delete waypoint"
                style={{
                  width: '28px',
                  height: '28px',
                  padding: 0,
                  border: 'none',
                  borderRadius: '6px',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  lineHeight: 1,
                }}
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
  showETA = false,
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
              previous={index > 0 ? sortedWaypoints[index - 1] : undefined}
              index={index}
              onEdit={onEdit}
              onDelete={onDelete}
              editable={editable}
              showETA={showETA}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
