import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTemplates } from '../hooks/useTemplates';
import { useRoutes } from '../hooks';
import { useAuth } from '../context';
import { AppLayout, SEO } from '../components';
import { createNewRoute, generateRouteId, generateWaypointId } from '../utils/routeHelpers';
import { COLORS } from '../utils/constants';
import type { Route, RouteTemplate } from '../types';

/**
 * Apply a template to produce a new draft Route, ready to save.
 * Waypoint IDs are regenerated so each applied route instance has globally unique IDs.
 */
function applyTemplate(template: RouteTemplate, brigadeId: string, createdBy?: string): Route {
  const base = createNewRoute(brigadeId, createdBy);
  return {
    ...base,
    id: generateRouteId(),
    name: template.name,
    description: template.description,
    waypoints: template.waypoints.map((wp, index) => ({
      ...wp,
      id: generateWaypointId(),
      order: index,
      isCompleted: false,
      actualArrival: undefined,
    })),
  };
}

export interface TemplateLibraryProps {
  /** Optional brigade ID override (defaults to authenticated user's brigade) */
  brigadeId?: string;
}

export function TemplateLibrary(_props: TemplateLibraryProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { templates, isLoading, error, deleteTemplate } = useTemplates();
  const { saveRoute } = useRoutes();
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleApplyTemplate = async (template: RouteTemplate) => {
    const brigadeId = user?.brigadeId;
    if (!brigadeId) return;

    setApplyingId(template.id);
    setActionError(null);

    try {
      const newRoute = applyTemplate(template, brigadeId, user?.email);
      await saveRoute(newRoute);
      navigate(`/routes/${newRoute.id}/edit`);
    } catch (err) {
      console.error('Failed to apply template:', err);
      setActionError('Failed to create route from template. Please try again.');
      setApplyingId(null);
    }
  };

  const handleDeleteTemplate = async (template: RouteTemplate) => {
    if (template.isBuiltIn) return;
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;

    setDeletingId(template.id);
    setActionError(null);

    try {
      await deleteTemplate(template.id);
    } catch (err) {
      console.error('Failed to delete template:', err);
      setActionError('Failed to delete template. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // Group templates by category
  const grouped = templates.reduce<Record<string, RouteTemplate[]>>((acc, t) => {
    const cat = t.category || 'My Templates';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  const categoryOrder = ['Suburban', 'Rural', 'My Templates'];
  const sortedCategories = [
    ...categoryOrder.filter(c => grouped[c]),
    ...Object.keys(grouped).filter(c => !categoryOrder.includes(c)),
  ];

  return (
    <>
      <SEO
        title="Template Library"
        description="Browse and apply reusable route templates for your Santa Run"
      />
      <AppLayout>
        <div
          style={{
            maxWidth: '900px',
            margin: '0 auto',
            padding: '2rem 1rem',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: '1.75rem',
                  color: COLORS.fireRed,
                  fontFamily: 'var(--font-heading)',
                }}
              >
                🗂️ Template Library
              </h1>
              <p style={{ margin: '0.25rem 0 0', color: COLORS.neutral700, fontSize: '0.9rem' }}>
                Start from a template or save your own for future runs
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '0.5rem 1rem',
                border: `1px solid ${COLORS.neutral300}`,
                borderRadius: '8px',
                background: 'white',
                color: COLORS.neutral900,
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.875rem',
              }}
            >
              ← Back to Dashboard
            </button>
          </div>

          {/* Error banner */}
          {actionError && (
            <div
              style={{
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                backgroundColor: '#ffebee',
                color: COLORS.fireRed,
                borderRadius: '8px',
                fontSize: '0.875rem',
              }}
            >
              {actionError}
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: COLORS.neutral700 }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎅</div>
              <p>Loading templates…</p>
            </div>
          )}

          {/* Error state */}
          {!isLoading && error && (
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
              <p style={{ color: COLORS.fireRed }}>{error.message}</p>
            </div>
          )}

          {/* Template list */}
          {!isLoading && !error && sortedCategories.map(category => (
            <div key={category} style={{ marginBottom: '2rem' }}>
              <h2
                style={{
                  margin: '0 0 0.75rem 0',
                  fontSize: '1rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: COLORS.neutral700,
                }}
              >
                {category}
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '1rem',
                }}
              >
                {grouped[category].map(template => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isApplying={applyingId === template.id}
                    isDeleting={deletingId === template.id}
                    onApply={() => handleApplyTemplate(template)}
                    onDelete={() => handleDeleteTemplate(template)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Empty state */}
          {!isLoading && !error && templates.length === 0 && (
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
              <h2 style={{ color: COLORS.neutral800, marginBottom: '0.5rem' }}>No templates yet</h2>
              <p style={{ color: COLORS.neutral700, maxWidth: '360px', margin: '0 auto 1.5rem' }}>
                Save a route as a template from the route editor to build up your library.
              </p>
              <button
                onClick={() => navigate('/routes/new')}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: `linear-gradient(135deg, ${COLORS.fireRed} 0%, ${COLORS.fireRedDark} 100%)`,
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ➕ Create a Route
              </button>
            </div>
          )}
        </div>
      </AppLayout>
    </>
  );
}

interface TemplateCardProps {
  template: RouteTemplate;
  isApplying: boolean;
  isDeleting: boolean;
  onApply: () => void;
  onDelete: () => void;
}

function TemplateCard({ template, isApplying, isDeleting, onApply, onDelete }: TemplateCardProps) {
  const waypointCount = template.waypoints.length;

  return (
    <div
      style={{
        border: `2px solid ${COLORS.neutral200}`,
        borderRadius: '12px',
        padding: '1.25rem',
        background: 'white',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div>
          <span style={{ fontSize: '1.5rem', marginRight: '0.5rem' }}>
            {template.isBuiltIn ? '⭐' : '📋'}
          </span>
          <span
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: COLORS.neutral900,
              fontFamily: 'var(--font-heading)',
            }}
          >
            {template.name}
          </span>
        </div>
        {template.isBuiltIn && (
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              backgroundColor: COLORS.sandBeige,
              color: COLORS.neutral800,
              padding: '0.15rem 0.5rem',
              borderRadius: '999px',
              whiteSpace: 'nowrap',
            }}
          >
            Built-in
          </span>
        )}
      </div>

      {/* Description */}
      {template.description && (
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: COLORS.neutral700,
            lineHeight: 1.5,
          }}
        >
          {template.description}
        </p>
      )}

      {/* Meta */}
      <p style={{ margin: 0, fontSize: '0.8rem', color: COLORS.neutral700 }}>
        {waypointCount > 0
          ? `${waypointCount} waypoint${waypointCount !== 1 ? 's' : ''}`
          : 'No waypoints — add your own after applying'}
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
        <button
          onClick={onApply}
          disabled={isApplying}
          style={{
            flex: 1,
            padding: '0.6rem 0.75rem',
            background: isApplying
              ? COLORS.neutral200
              : `linear-gradient(135deg, ${COLORS.christmasGreen} 0%, #2e7d32 100%)`,
            color: isApplying ? COLORS.neutral700 : 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: isApplying ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.2s',
          }}
        >
          {isApplying ? 'Creating…' : '🚀 Use Template'}
        </button>

        {!template.isBuiltIn && (
          <button
            onClick={onDelete}
            disabled={isDeleting}
            title="Delete template"
            style={{
              padding: '0.6rem 0.75rem',
              background: 'white',
              color: COLORS.fireRed,
              border: `1px solid ${COLORS.fireRed}`,
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isDeleting) {
                e.currentTarget.style.background = COLORS.fireRed;
                e.currentTarget.style.color = 'white';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.color = COLORS.fireRed;
            }}
          >
            {isDeleting ? '…' : '🗑️'}
          </button>
        )}
      </div>
    </div>
  );
}
