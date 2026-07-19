/**
 * Brigade Settings Page — admin-only branding and contact management.
 *
 * Lets brigade admins upload a logo, pick a theme colour, and update contact
 * details. Accessible at /dashboard/:brigadeId/settings.
 *
 * Logo handling: the file is resized client-side (canvas, max 400 × 400 px,
 * JPEG 85 %) and stored as a data URL in the brigade record. Compressed logos
 * for a typical brigade badge are well under the Azure Table Storage 64 KB
 * per-property limit.
 */

import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context';
import { storageAdapter } from '../storage';
import { safeImageSrc } from '../utils/publicBrigade';
import { AppLayout, SEO, BillingPanel } from '../components';
import type { Brigade } from '../storage/types';
import './BrigadeSettingsPage.css';

const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB raw upload limit
const LOGO_MAX_PX = 400;
const LOGO_QUALITY = 0.85;
const DEFAULT_THEME_COLOR = '#D32F2F'; // --fire-red

async function compressLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode the image.'));
      img.onload = () => {
        let { width, height } = img;
        if (!width || !height) {
          reject(new Error('The image appears to be empty or corrupt.'));
          return;
        }
        if (width > LOGO_MAX_PX || height > LOGO_MAX_PX) {
          if (width >= height) {
            height = Math.round((height * LOGO_MAX_PX) / width);
            width = LOGO_MAX_PX;
          } else {
            width = Math.round((width * LOGO_MAX_PX) / height);
            height = LOGO_MAX_PX;
          }
        }
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas not available.'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', LOGO_QUALITY);
          // Azure Table Storage caps a single string property at 64 KB. A data
          // URL is ~33% larger than its bytes, so keep a margin for safety.
          if (dataUrl.length > 60_000) {
            reject(
              new Error(
                'That image is too detailed to store — please try a simpler logo or a smaller file.',
              ),
            );
            return;
          }
          resolve(dataUrl);
        } catch {
          reject(new Error('Could not process the image. Please try another file.'));
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function BrigadeSettingsPage() {
  const { brigadeId } = useParams<{ brigadeId: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [brigade, setBrigade] = useState<Brigade | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Form state
  const [logoPreview, setLogoPreview] = useState<string | undefined>();
  const [themeColor, setThemeColor] = useState(DEFAULT_THEME_COLOR);
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactWebsite, setContactWebsite] = useState('');

  // Logo upload state
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save state
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!brigadeId) {
      navigate('/dashboard');
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const b = await storageAdapter.getBrigade(brigadeId!);
        if (!b) {
          navigate('/dashboard');
          return;
        }
        setBrigade(b);
        setLogoPreview(safeImageSrc(b.logo));
        setThemeColor(b.themeColor || DEFAULT_THEME_COLOR);
        setContactEmail(b.contact?.email ?? '');
        setContactPhone(b.contact?.phone ?? '');
        setContactWebsite(b.contact?.website ?? '');
      } catch (err) {
        console.error('Failed to load brigade:', err);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [brigadeId, navigate]);

  // Only owners/admins of the brigade's own organization may edit settings.
  // Wait for auth to finish loading before deciding — otherwise a not-yet-
  // populated user would incorrectly deny access.
  useEffect(() => {
    if (!brigade || authLoading) return;
    const canEdit = user?.brigadeId === brigade.id && (user?.role === 'owner' || user?.role === 'admin');
    setAccessDenied(!canEdit);
  }, [brigade, user, authLoading]);

  async function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoError(null);

    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      setLogoError('Please choose a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('Image must be 2 MB or smaller.');
      return;
    }

    try {
      const dataUrl = await compressLogo(file);
      setLogoPreview(dataUrl);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Failed to process image.');
    }
  }

  function handleRemoveLogo() {
    setLogoPreview(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSave() {
    if (!brigade) return;
    setSaveState('saving');
    setSaveError(null);

    const updated: Brigade = {
      ...brigade,
      logo: logoPreview ?? '',
      themeColor,
      contact: {
        email: contactEmail.trim() || undefined,
        phone: contactPhone.trim() || undefined,
        website: contactWebsite.trim() || undefined,
      },
      updatedAt: new Date().toISOString(),
    };

    try {
      await storageAdapter.saveBrigade(updated);
      setBrigade(updated);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 3000);
    } catch (err) {
      console.error('Failed to save brigade settings:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings.');
      setSaveState('error');
    }
  }

  if (loading || authLoading) {
    return (
      <AppLayout>
        <div className="bsp__loading" role="status" aria-live="polite">
          <div className="bsp__loading-emoji">🎅</div>
          <p>Loading brigade settings…</p>
        </div>
      </AppLayout>
    );
  }

  if (accessDenied || !brigade) {
    return (
      <AppLayout>
        <SEO title="Brigade Settings" />
        <div className="bsp__denied">
          <div className="bsp__denied-emoji">🔒</div>
          <h1>Admin access required</h1>
          <p>Only brigade admins can edit brigade settings.</p>
          <Link to="/dashboard">← Back to dashboard</Link>
        </div>
      </AppLayout>
    );
  }

  const accentStyle = { '--brigade-accent': themeColor } as React.CSSProperties;

  return (
    <AppLayout>
      <SEO title={`Brigade Settings — ${brigade.name}`} />
      <div className="bsp" style={accentStyle}>
        <div className="bsp__container">
          <header className="bsp__header">
            <Link to="/dashboard" className="bsp__back">← Dashboard</Link>
            <h1 className="bsp__title">Brigade Settings</h1>
            <p className="bsp__subtitle">{brigade.name}</p>
          </header>

          {/* Logo */}
          <section className="bsp__section" aria-labelledby="bsp-logo">
            <h2 className="bsp__section-title" id="bsp-logo">Brigade Logo</h2>
            <div className="bsp__logo-row">
              <div className="bsp__logo-preview">
                {logoPreview ? (
                  <img src={logoPreview} alt="Brigade logo preview" />
                ) : (
                  <span aria-hidden="true">🚒</span>
                )}
              </div>
              <div className="bsp__logo-actions">
                <label className="bsp__file-label" htmlFor="logo-upload">
                  {logoPreview ? 'Change logo' : 'Upload logo'}
                </label>
                <input
                  id="logo-upload"
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_LOGO_TYPES.join(',')}
                  className="bsp__file-input"
                  onChange={handleLogoChange}
                  aria-describedby="logo-hint"
                />
                {logoPreview && (
                  <button
                    type="button"
                    className="bsp__btn bsp__btn--ghost"
                    onClick={handleRemoveLogo}
                  >
                    Remove logo
                  </button>
                )}
                <p id="logo-hint" className="bsp__hint">
                  PNG, JPEG, or WebP · max 2 MB · resized to 400 × 400 px
                </p>
                {logoError && (
                  <p className="bsp__field-error" role="alert">
                    {logoError}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Theme colour */}
          <section className="bsp__section" aria-labelledby="bsp-theme">
            <h2 className="bsp__section-title" id="bsp-theme">Theme Colour</h2>
            <div className="bsp__color-row">
              <label htmlFor="theme-color" className="bsp__label">
                Accent colour
              </label>
              <div className="bsp__color-picker-wrap">
                <input
                  id="theme-color"
                  type="color"
                  className="bsp__color-input"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  aria-label="Pick brigade accent colour"
                />
                <span className="bsp__color-value">{themeColor}</span>
              </div>
              <button
                type="button"
                className="bsp__btn bsp__btn--ghost"
                onClick={() => setThemeColor(DEFAULT_THEME_COLOR)}
                disabled={themeColor === DEFAULT_THEME_COLOR}
              >
                Reset to default
              </button>
            </div>
            <div className="bsp__color-preview" aria-hidden="true">
              <div className="bsp__color-swatch" style={{ background: themeColor }} />
              <span>Preview: header accent stripe</span>
            </div>
          </section>

          {/* Contact info */}
          <section className="bsp__section" aria-labelledby="bsp-contact">
            <h2 className="bsp__section-title" id="bsp-contact">Contact Information</h2>
            <p className="bsp__section-desc">
              Displayed publicly on your brigade&apos;s profile page.
            </p>
            <div className="bsp__fields">
              <div className="bsp__field">
                <label htmlFor="contact-email" className="bsp__label">
                  Email address
                </label>
                <input
                  id="contact-email"
                  type="email"
                  className="bsp__input"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="brigade@example.com"
                  autoComplete="email"
                />
              </div>
              <div className="bsp__field">
                <label htmlFor="contact-phone" className="bsp__label">
                  Phone number
                </label>
                <input
                  id="contact-phone"
                  type="tel"
                  className="bsp__input"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="02 1234 5678"
                  autoComplete="tel"
                />
              </div>
              <div className="bsp__field">
                <label htmlFor="contact-website" className="bsp__label">
                  Website URL
                </label>
                <input
                  id="contact-website"
                  type="url"
                  className="bsp__input"
                  value={contactWebsite}
                  onChange={(e) => setContactWebsite(e.target.value)}
                  placeholder="https://example.com"
                  autoComplete="url"
                />
              </div>
            </div>
          </section>

          {/* Subscription & billing */}
          <BillingPanel brigade={brigade} />

          {/* Save */}
          <div className="bsp__actions">
            {saveState === 'error' && saveError && (
              <p className="bsp__save-error" role="alert">{saveError}</p>
            )}
            {saveState === 'saved' && (
              <p className="bsp__save-success" role="status">Settings saved!</p>
            )}
            <button
              type="button"
              className="bsp__btn bsp__btn--primary"
              onClick={handleSave}
              disabled={saveState === 'saving'}
              aria-busy={saveState === 'saving'}
            >
              {saveState === 'saving' ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
