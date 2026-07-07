/**
 * ImportModal — upload a JSON backup / GPX / KML file, preview the parsed
 * routes with validation issues and duplicate detection, choose per-route
 * conflict resolution, then confirm the import.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Route } from '../types';
import {
  parseImportFile,
  markDuplicates,
  resolveCandidate,
  type ImportCandidate,
} from '../utils/routeImport';
import { COLORS, Z_INDEX } from '../utils/constants';

export interface ImportModalProps {
  brigadeId: string;
  existingRoutes: Route[];
  onClose: () => void;
  /** Called with the resolved routes to persist; resolves when saved. */
  onImport: (routes: Route[]) => Promise<void>;
}

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export function ImportModal({ brigadeId, existingRoutes, onClose, onImport }: ImportModalProps) {
  const [candidates, setCandidates] = useState<ImportCandidate[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isImporting) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, isImporting]);

  const handleFile = useCallback(async (file: File) => {
    setErrors([]);
    setCandidates(null);
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setErrors(['File is too large (max 10 MB)']);
      return;
    }
    try {
      const content = await file.text();
      const result = parseImportFile(file.name, content);
      setErrors(result.errors);
      if (result.candidates.length > 0) {
        setCandidates(markDuplicates(result.candidates, existingRoutes));
      }
    } catch {
      setErrors(['Could not read the selected file']);
    }
  }, [existingRoutes]);

  const setResolution = (index: number, resolution: ImportCandidate['resolution']) => {
    setCandidates(prev => prev?.map((c, i) => (i === index ? { ...c, resolution } : c)) ?? null);
  };

  const toImportCount = candidates?.filter(c => c.resolution !== 'skip').length ?? 0;

  const handleConfirm = async () => {
    if (!candidates) return;
    setIsImporting(true);
    try {
      const routes = candidates
        .map(c => resolveCandidate(c, brigadeId))
        .filter((r): r is Route => r !== null);
      await onImport(routes);
      onClose();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Import failed — please try again']);
      setIsImporting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import routes"
      onClick={() => !isImporting && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: Z_INDEX.modal, padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          padding: '1.5rem', width: 'min(560px, 100%)', maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: COLORS.fireRed }}>📥 Import routes</h2>
          <button
            onClick={onClose}
            disabled={isImporting}
            aria-label="Close import dialog"
            style={{
              background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer',
              color: COLORS.neutral700, minWidth: '44px', minHeight: '44px',
            }}
          >
            ✕
          </button>
        </div>

        {!candidates && (
          <>
            <p style={{ color: COLORS.neutral700, fontSize: '0.9rem', marginTop: 0 }}>
              Restore a Fire Santa Run JSON backup, or import routes from GPX / KML files.
              You'll see a preview before anything is saved.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%', padding: '2rem 1rem',
                border: `2px dashed ${COLORS.neutral300}`, borderRadius: '12px',
                background: COLORS.sandLight, cursor: 'pointer',
                fontSize: '1rem', fontWeight: 600, color: COLORS.neutral900,
              }}
            >
              📁 Choose a .json, .gpx or .kml file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.gpx,.kml,application/json,application/gpx+xml,application/vnd.google-earth.kml+xml"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
          </>
        )}

        {errors.length > 0 && (
          <div
            role="alert"
            style={{
              marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: '8px',
              background: '#FFEBEE', border: `1px solid ${COLORS.fireRedLight}`,
              color: COLORS.fireRedDark, fontSize: '0.875rem',
            }}
          >
            {errors.map((err, i) => <div key={i}>⚠️ {err}</div>)}
          </div>
        )}

        {candidates && (
          <>
            <p style={{ color: COLORS.neutral700, fontSize: '0.9rem' }}>
              Found <strong>{candidates.length}</strong> route{candidates.length === 1 ? '' : 's'}.
              Review and confirm to import.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {candidates.map((candidate, i) => (
                <div
                  key={candidate.route.id}
                  style={{
                    padding: '0.875rem 1rem', borderRadius: '12px',
                    border: `1px solid ${candidate.duplicateOf ? COLORS.summerGold : COLORS.neutral200}`,
                    background: candidate.resolution === 'skip' ? '#FAFAFA' : 'white',
                    opacity: candidate.resolution === 'skip' ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: COLORS.neutral900 }}>🎄 {candidate.route.name}</div>
                      <div style={{ fontSize: '0.8rem', color: COLORS.neutral700 }}>
                        {candidate.route.date} · {candidate.route.waypoints.length} stops
                        {candidate.route.geometry ? ' · has route path' : ''}
                      </div>
                    </div>
                    {candidate.duplicateOf ? (
                      <select
                        value={candidate.resolution}
                        onChange={e => setResolution(i, e.target.value as ImportCandidate['resolution'])}
                        aria-label={`Duplicate resolution for ${candidate.route.name}`}
                        style={{
                          padding: '0.5rem', borderRadius: '8px',
                          border: `1px solid ${COLORS.neutral300}`, fontSize: '0.875rem',
                        }}
                      >
                        <option value="copy">Import as copy</option>
                        <option value="replace">Replace existing</option>
                        <option value="skip">Skip</option>
                      </select>
                    ) : (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', color: COLORS.neutral700 }}>
                        <input
                          type="checkbox"
                          checked={candidate.resolution !== 'skip'}
                          onChange={e => setResolution(i, e.target.checked ? 'import' : 'skip')}
                        />
                        Import
                      </label>
                    )}
                  </div>
                  {candidate.issues.length > 0 && (
                    <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', fontSize: '0.8rem', color: '#B26A00' }}>
                      {candidate.issues.map((issue, j) => <li key={j}>{issue.message}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button
                onClick={() => { setCandidates(null); setErrors([]); }}
                disabled={isImporting}
                style={{
                  flex: 1, padding: '0.875rem 1rem', background: 'white',
                  border: `2px solid ${COLORS.neutral300}`, borderRadius: '12px',
                  fontWeight: 600, cursor: 'pointer', color: COLORS.neutral900,
                }}
              >
                ← Choose another file
              </button>
              <button
                onClick={handleConfirm}
                disabled={isImporting || toImportCount === 0}
                style={{
                  flex: 1, padding: '0.875rem 1rem',
                  background: toImportCount === 0
                    ? COLORS.neutral200
                    : `linear-gradient(135deg, ${COLORS.christmasGreen} 0%, ${COLORS.eucalyptusGreen} 100%)`,
                  color: toImportCount === 0 ? COLORS.neutral700 : 'white',
                  border: 'none', borderRadius: '12px', fontWeight: 600,
                  cursor: toImportCount === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {isImporting ? 'Importing…' : `✓ Import ${toImportCount} route${toImportCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
