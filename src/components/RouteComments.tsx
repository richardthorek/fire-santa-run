/**
 * RouteComments — brigade-internal comment thread on a route, with optional
 * waypoint tagging. Comments live on the Route object so they sync through
 * the normal storage adapters on both backends.
 */

import { useState } from 'react';
import type { Route, RouteComment } from '../types';
import { COLORS } from '../utils/constants';

export interface RouteCommentsProps {
  route: Route;
  currentUser: { id: string; name: string } | null;
  /** Persist the updated route (comments changed). */
  onSave: (route: Route) => Promise<void>;
}

const MAX_COMMENT_LENGTH = 1000;

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function RouteComments({ route, currentUser, onSave }: RouteCommentsProps) {
  const [text, setText] = useState('');
  const [waypointId, setWaypointId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const comments = [...(route.comments ?? [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const sortedWaypoints = [...route.waypoints].sort((a, b) => a.order - b.order);
  const waypointName = (id: string) => {
    const index = sortedWaypoints.findIndex(wp => wp.id === id);
    if (index === -1) return 'removed stop';
    return sortedWaypoints[index].name || `Stop ${index + 1}`;
  };

  const handleAdd = async () => {
    if (!currentUser || !text.trim()) return;
    setIsSaving(true);
    setError(null);
    const comment: RouteComment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      text: text.trim().slice(0, MAX_COMMENT_LENGTH),
      waypointId: waypointId || undefined,
      createdAt: new Date().toISOString(),
    };
    try {
      await onSave({ ...route, comments: [...(route.comments ?? []), comment] });
      setText('');
      setWaypointId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave({ ...route, comments: (route.comments ?? []).filter(c => c.id !== commentId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section aria-label="Route comments">
      <h3 style={{ margin: 0, marginBottom: '0.75rem', fontSize: '1rem', color: COLORS.neutral900 }}>
        💬 Comments ({comments.length})
      </h3>

      {comments.length === 0 ? (
        <p style={{ color: COLORS.neutral700, fontSize: '0.875rem' }}>
          No comments yet — leave a note for your crew.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {comments.map(comment => (
            <div
              key={comment.id}
              style={{
                padding: '0.75rem',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '8px',
                border: `1px solid ${COLORS.neutral200}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.8rem', color: COLORS.neutral900 }}>
                  {comment.userName}
                  {comment.waypointId && (
                    <span style={{
                      marginLeft: '0.5rem', fontWeight: 600, fontSize: '0.7rem',
                      background: COLORS.sandLight, color: '#B26A00',
                      padding: '0.1rem 0.5rem', borderRadius: '999px',
                    }}>
                      📍 {waypointName(comment.waypointId)}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: '0.75rem', color: COLORS.neutral700, whiteSpace: 'nowrap' }}>
                  {timeAgo(comment.createdAt)}
                </span>
              </div>
              <div style={{ fontSize: '0.875rem', color: COLORS.neutral900, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {comment.text}
              </div>
              {currentUser?.id === comment.userId && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  disabled={isSaving}
                  style={{
                    marginTop: '0.25rem', background: 'none', border: 'none',
                    color: COLORS.neutral700, fontSize: '0.75rem', cursor: 'pointer',
                    padding: '0.25rem 0', textDecoration: 'underline',
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {currentUser && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Add a comment for your brigade…"
            maxLength={MAX_COMMENT_LENGTH}
            rows={2}
            aria-label="New comment"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.75rem',
              borderRadius: '8px', border: `1px solid ${COLORS.neutral300}`,
              fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              value={waypointId}
              onChange={e => setWaypointId(e.target.value)}
              aria-label="Tag a stop (optional)"
              style={{
                flex: 1, padding: '0.5rem', borderRadius: '8px',
                border: `1px solid ${COLORS.neutral300}`, fontSize: '0.8rem',
                color: COLORS.neutral700, minHeight: '44px',
              }}
            >
              <option value="">No stop tagged</option>
              {sortedWaypoints.map((wp, i) => (
                <option key={wp.id} value={wp.id}>📍 {wp.name || `Stop ${i + 1}`}</option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={isSaving || !text.trim()}
              style={{
                padding: '0.5rem 1rem', minHeight: '44px',
                background: text.trim()
                  ? `linear-gradient(135deg, ${COLORS.christmasGreen} 0%, ${COLORS.eucalyptusGreen} 100%)`
                  : COLORS.neutral200,
                color: text.trim() ? 'white' : COLORS.neutral700,
                border: 'none', borderRadius: '8px', fontWeight: 600,
                fontSize: '0.875rem', cursor: text.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              {isSaving ? 'Saving…' : 'Post'}
            </button>
          </div>
          {error && (
            <div role="alert" style={{ color: COLORS.error, fontSize: '0.8rem' }}>⚠️ {error}</div>
          )}
        </div>
      )}
    </section>
  );
}
