import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';
import { useAuth } from '../context';
import { RoleBadge, AppLayout } from '../components';
import { COLORS } from '../utils/constants';

/**
 * User Profile Page
 *
 * Displays account information and lets the user update their profile.
 * Brigade membership, roles, and switching between brigades are governed by
 * Station Manager (the StationKit suite identity provider) — see AuthContext.
 */
export function ProfilePage() {
  const { user, isLoading, error, updateProfile } = useUserProfile();
  const { organizationName, memberships, switchBrigade, user: authUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const handleEdit = () => {
    setEditName(user?.name || '');
    setIsEditing(true);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!user || !editName.trim()) {
      setSaveError('Name cannot be empty');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await updateProfile({ name: editName.trim() });
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSaveError(null);
  };

  const handleSwitchBrigade = async (organizationId: string) => {
    setIsSwitching(true);
    setSwitchError(null);
    try {
      await switchBrigade(organizationId);
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : 'Failed to switch brigade');
    } finally {
      setIsSwitching(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
        <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🎅</div>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
        <div style={{ fontSize: '48px', marginBottom: '1rem' }}>😞</div>
        <h1 style={{ color: COLORS.fireRed, marginBottom: '0.5rem' }}>Profile Error</h1>
        <p style={{ color: COLORS.neutral700, marginBottom: '2rem' }}>{error || 'Failed to load profile'}</p>
        <Link to="/dashboard" style={{ padding: '0.75rem 1.5rem', background: `linear-gradient(135deg, ${COLORS.fireRed} 0%, ${COLORS.fireRedDark} 100%)`, color: 'white', textDecoration: 'none', borderRadius: '12px', fontWeight: 600 }}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <AppLayout>
      <div style={{ minHeight: '100vh', backgroundColor: COLORS.neutral50, padding: '2rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <Link to="/dashboard" style={{ color: COLORS.fireRed, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, display: 'inline-block', marginBottom: '1rem' }}>
              ← Back to Dashboard
            </Link>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: COLORS.neutral900, marginBottom: '0.5rem' }}>Your Profile</h1>
            <p style={{ fontSize: '1rem', color: COLORS.neutral700 }}>Manage your account information</p>
          </div>

          {/* Profile Card */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', padding: '2rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: COLORS.neutral900, marginBottom: '1.5rem' }}>Account Information</h2>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: COLORS.neutral700, marginBottom: '0.5rem' }}>Name</label>
              {isEditing ? (
                <div>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter your name"
                    style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: `1px solid ${COLORS.neutral300}`, borderRadius: '8px', marginBottom: '0.5rem' }}
                  />
                  {saveError && <p style={{ fontSize: '0.875rem', color: COLORS.fireRed, marginBottom: '0.5rem' }}>{saveError}</p>}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: 'white', background: `linear-gradient(135deg, ${COLORS.christmasGreen} 0%, ${COLORS.eucalyptusGreen} 100%)`, border: 'none', borderRadius: '8px', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1 }}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={isSaving}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: COLORS.neutral700, background: COLORS.neutral200, border: 'none', borderRadius: '8px', cursor: isSaving ? 'not-allowed' : 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: '1rem', color: COLORS.neutral900, margin: 0 }}>{user.name}</p>
                  <button
                    onClick={handleEdit}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: COLORS.fireRed, background: 'transparent', border: `1px solid ${COLORS.fireRed}`, borderRadius: '8px', cursor: 'pointer' }}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: COLORS.neutral700, marginBottom: '0.5rem' }}>Email</label>
              <p style={{ fontSize: '1rem', color: COLORS.neutral900, margin: 0 }}>{user.email}</p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: COLORS.neutral700, marginBottom: '0.5rem' }}>Member Since</label>
              <p style={{ fontSize: '1rem', color: COLORS.neutral900, margin: 0 }}>
                {new Date(user.createdAt).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Brigade Card */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: COLORS.neutral900, marginBottom: '1.5rem' }}>Your Brigade</h2>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: memberships.length > 1 ? '1.5rem' : 0 }}>
              <div>
                <p style={{ fontSize: '1.125rem', fontWeight: 700, color: COLORS.neutral900, margin: 0 }}>
                  {organizationName || 'Your brigade'}
                </p>
                <p style={{ fontSize: '0.875rem', color: COLORS.neutral700, margin: '0.25rem 0 0' }}>
                  Managed via your StationKit account — Station Manager, Fire Santa Run, and Fire Break Calculator all share it.
                </p>
              </div>
              {authUser?.role && <RoleBadge role={authUser.role} />}
            </div>

            {memberships.length > 1 && (
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: COLORS.neutral700, marginBottom: '0.5rem' }}>
                  Switch brigade
                </label>
                <select
                  value={authUser?.brigadeId || ''}
                  onChange={(e) => handleSwitchBrigade(e.target.value)}
                  disabled={isSwitching}
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: `1px solid ${COLORS.neutral300}`, borderRadius: '8px', backgroundColor: 'white', color: COLORS.neutral900 }}
                >
                  {memberships.map((m) => (
                    <option key={m.organizationId} value={m.organizationId}>
                      {m.organizationName} ({m.role})
                    </option>
                  ))}
                </select>
                {switchError && <p style={{ fontSize: '0.875rem', color: COLORS.fireRed, marginTop: '0.5rem' }}>{switchError}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
