import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';
import { useAuth } from '../context';
import { storageAdapter } from '../storage';
import { MembershipService } from '../services/membershipService';
import { RoleBadge, AppLayout } from '../components';
import { COLORS } from '../utils/constants';
import type { BrigadeMembership, MemberRole } from '../types/membership';
import type { Brigade } from '../storage/types';
import { useRef } from 'react';

const membershipService = new MembershipService(storageAdapter);

/**
 * User Profile Page
 * 
 * Displays user information, brigade memberships, and allows profile updates.
 * Automatically creates user profile on first login.
 */
export function ProfilePage() {
  if (import.meta.env.DEV) {
    // Helps detect remounts causing repeated effects
    console.debug('ProfilePage mounted', { ts: Date.now() });
  }
  const { user, memberships, isLoading, error, updateProfile } = useUserProfile();
  const { setActiveBrigadeId } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [brigadeOptions, setBrigadeOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedBrigadeId, setSelectedBrigadeId] = useState<string | undefined>(undefined);
  const [brigadeError, setBrigadeError] = useState<string | null>(null);
  const [isUpdatingBrigade, setIsUpdatingBrigade] = useState(false);
  const selectionInitializedRef = useRef(false);

  // Load brigades once on mount and when memberships actually change; select first active brigade locally.
  // If none, show error. No auto-persist.
  useEffect(() => {
    let isCancelled = false;
    const loadOnce = async () => {
      // Stronger guard: only run once per mount
      if (selectionInitializedRef.current) {
        if (import.meta.env.DEV) {
          console.debug('ProfilePage: selection already initialized, skipping');
        }
        return;
      }

      // Don't initialize until we have loaded user data
      if (isLoading || !user) {
        return;
      }

      selectionInitializedRef.current = true;

      if (!memberships.length) {
        setBrigadeOptions([]);
        setSelectedBrigadeId(undefined);
        return;
      }

      try {
        const activeMemberships = memberships.filter(m => m.status === 'active');
        const uniqueIds = Array.from(new Set(activeMemberships.map(m => m.brigadeId)));
        const brigades = await Promise.all(uniqueIds.map(async (id) => {
          const brigade = await storageAdapter.getBrigade(id);
          return { id, name: brigade?.name || 'Unknown Brigade' };
        }));

        if (isCancelled) return;

        setBrigadeOptions(brigades);
        const preferredId = user?.brigadeId;
        const resolvedId = (preferredId && brigades.some(b => b.id === preferredId) ? preferredId : undefined)
          ?? brigades[0]?.id;

        if (import.meta.env.DEV) {
          console.debug('ProfilePage single-load selection (no auto-persist)', {
            membershipsCount: memberships.length,
            activeMemberships: activeMemberships.map(m => ({ id: m.id, brigadeId: m.brigadeId, status: m.status })),
            preferredId,
            resolvedId,
            userBrigadeId: user?.brigadeId,
          });
        }

        if (!resolvedId) {
          setBrigadeError('No active brigades found');
          return;
        }

        setSelectedBrigadeId(resolvedId);
        // Don't call setActiveBrigadeId here - it triggers BrigadeContext reload which unmounts this component
        // Only set it in the dropdown handler when user explicitly changes selection
      } catch (err) {
        if (isCancelled) return;
        console.error('Failed to load brigades for selection:', err);
        setBrigadeError('Failed to load brigades');
      }
    };

    loadOnce();
    return () => {
      isCancelled = true;
    };
  // The guard prevents re-execution, memberships is stabilized in useUserProfile
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user, memberships]);

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

  const handleActiveBrigadeChange = async (brigadeId: string) => {
    setSelectedBrigadeId(brigadeId);
    setBrigadeError(null);
    setIsUpdatingBrigade(true);

    try {
      if (import.meta.env.DEV) {
        console.debug('handleActiveBrigadeChange', { brigadeId });
      }
      await updateProfile({ brigadeId });
      setActiveBrigadeId(brigadeId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update brigade';
      setBrigadeError(message);
    } finally {
      setIsUpdatingBrigade(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🎅</div>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '1rem' }}>😞</div>
        <h1 style={{ color: COLORS.fireRed, marginBottom: '0.5rem' }}>
          Profile Error
        </h1>
        <p style={{ color: COLORS.neutral700, marginBottom: '2rem' }}>
          {error || 'Failed to load profile'}
        </p>
        <Link
          to="/dashboard"
          style={{
            padding: '0.75rem 1.5rem',
            background: `linear-gradient(135deg, ${COLORS.fireRed} 0%, ${COLORS.fireRedDark} 100%)`,
            color: 'white',
            textDecoration: 'none',
            borderRadius: '12px',
            fontWeight: 600,
          }}
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const selectedBrigadeName = brigadeOptions.find(b => b.id === selectedBrigadeId)?.name;
  const hasActiveBrigades = brigadeOptions.length > 0;

  return (
    <AppLayout>
    <div style={{
      minHeight: '100vh',
      backgroundColor: COLORS.neutral50,
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <Link
            to="/dashboard"
            style={{
              color: COLORS.fireRed,
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
              display: 'inline-block',
              marginBottom: '1rem',
            }}
          >
            ← Back to Dashboard
          </Link>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: COLORS.neutral900,
            marginBottom: '0.5rem',
          }}>
            Your Profile
          </h1>
          <p style={{
            fontSize: '1rem',
            color: COLORS.neutral700,
          }}>
            Manage your account information and brigade memberships
          </p>
        </div>

        {/* Profile Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          padding: '2rem',
          marginBottom: '2rem',
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: COLORS.neutral900,
            marginBottom: '1.5rem',
          }}>
            Account Information
          </h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: COLORS.neutral700,
              marginBottom: '0.5rem',
            }}>
              Name
            </label>
            {isEditing ? (
              <div>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter your name"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: `1px solid ${COLORS.neutral300}`,
                    borderRadius: '8px',
                    marginBottom: '0.5rem',
                  }}
                />
                {saveError && (
                  <p style={{
                    fontSize: '0.875rem',
                    color: COLORS.fireRed,
                    marginBottom: '0.5rem',
                  }}>
                    {saveError}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'white',
                      background: `linear-gradient(135deg, ${COLORS.christmasGreen} 0%, ${COLORS.eucalyptusGreen} 100%)`,
                      border: 'none',
                      borderRadius: '8px',
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      opacity: isSaving ? 0.7 : 1,
                    }}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: COLORS.neutral700,
                      background: COLORS.neutral200,
                      border: 'none',
                      borderRadius: '8px',
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <p style={{
                    fontSize: '1rem',
                    color: COLORS.neutral900,
                    margin: 0,
                  }}>
                    {user.name}
                  </p>
                  <p style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: COLORS.neutral700,
                    margin: 0,
                    textTransform: 'uppercase',
                  }}>
                    {selectedBrigadeName ? `Active Brigade: ${selectedBrigadeName}` : 'No active brigade selected'}
                  </p>
                </div>
                <button
                  onClick={handleEdit}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: COLORS.fireRed,
                    background: 'transparent',
                    border: `1px solid ${COLORS.fireRed}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: COLORS.neutral700,
              marginBottom: '0.5rem',
            }}>
              Choose Active Brigade
            </label>
            {hasActiveBrigades ? (
              <div>
                <select
                  value={selectedBrigadeId || ''}
                  onChange={(e) => handleActiveBrigadeChange(e.target.value)}
                  disabled={isUpdatingBrigade}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: `1px solid ${COLORS.neutral300}`,
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    color: COLORS.neutral900,
                  }}
                >
                  <option value="" disabled>Select a brigade</option>
                  {brigadeOptions.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <p style={{
                  marginTop: '0.35rem',
                  fontSize: '0.8rem',
                  color: COLORS.neutral700,
                }}>
                  {selectedBrigadeName ? `Active: ${selectedBrigadeName}` : 'Select which brigade to use for routes and dashboard'}
                </p>
                {brigadeError && (
                  <p style={{
                    fontSize: '0.875rem',
                    color: COLORS.fireRed,
                    marginTop: '0.35rem',
                  }}>
                    {brigadeError}
                  </p>
                )}
              </div>
            ) : (
              <p style={{
                fontSize: '0.95rem',
                color: COLORS.neutral700,
                margin: 0,
              }}>
                No active brigades yet. Claim or accept an invitation to enable selection.
              </p>
            )}
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: COLORS.neutral700,
              marginBottom: '0.5rem',
            }}>
              Email
            </label>
            <p style={{
              fontSize: '1rem',
              color: COLORS.neutral900,
              margin: 0,
            }}>
              {user.email}
            </p>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: COLORS.neutral700,
              marginBottom: '0.5rem',
            }}>
              Member Since
            </label>
            <p style={{
              fontSize: '1rem',
              color: COLORS.neutral900,
              margin: 0,
            }}>
              {new Date(user.createdAt).toLocaleDateString('en-AU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Brigade Memberships Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          padding: '2rem',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: COLORS.neutral900,
              margin: 0,
            }}>
              Brigade Memberships
            </h2>
            <Link
              to="/brigades/claim"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'white',
                background: `linear-gradient(135deg, ${COLORS.fireRed} 0%, ${COLORS.fireRedDark} 100%)`,
                textDecoration: 'none',
                borderRadius: '8px',
              }}
            >
              + Claim Brigade
            </Link>
          </div>

          {memberships.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1rem',
            }}>
              <div style={{ fontSize: '64px', marginBottom: '1rem' }}>🚒</div>
              <p style={{
                fontSize: '1rem',
                color: COLORS.neutral700,
                marginBottom: '1.5rem',
              }}>
                You're not a member of any brigades yet
              </p>
              <Link
                to="/brigades/claim"
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'white',
                  background: `linear-gradient(135deg, ${COLORS.fireRed} 0%, ${COLORS.fireRedDark} 100%)`,
                  textDecoration: 'none',
                  borderRadius: '12px',
                  display: 'inline-block',
                }}
              >
                Claim Your First Brigade
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {memberships.map((membership) => (
                <MembershipCard key={membership.id} membership={membership} userId={user.id} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </AppLayout>
  );
}

// Helper component for membership cards
function MembershipCard({ membership, userId }: { membership: BrigadeMembership; userId: string }) {
  const [brigade, setBrigade] = useState<Brigade | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);

  // Load brigade details
  useEffect(() => {
    const loadBrigade = async () => {
      try {
        const b = await storageAdapter.getBrigade(membership.brigadeId);
        setBrigade(b);
      } catch (err) {
        console.error('Failed to load brigade:', err);
      } finally {
        setLoading(false);
      }
    };
    loadBrigade();
  }, [membership.brigadeId]);

  const handleLeaveBrigade = async () => {
    if (membership.role === 'admin' && brigade && brigade.adminUserIds.length <= 1) {
      alert('You cannot leave this brigade because you are the last admin. Please promote another member to admin first.');
      return;
    }

    if (!confirm(`Are you sure you want to leave ${brigade?.name || 'this brigade'}? This action cannot be undone.`)) {
      return;
    }

    setLeaving(true);
    try {
      const result = await membershipService.leaveBrigade(userId, membership.brigadeId);
      if (result.success) {
        // Refresh the page to update memberships
        window.location.reload();
      } else {
        alert(result.error || 'Failed to leave brigade');
      }
    } catch (err) {
      console.error('Failed to leave brigade:', err);
      alert('Failed to leave brigade');
    } finally {
      setLeaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        padding: '1rem',
        border: `1px solid ${COLORS.neutral200}`,
        borderRadius: '12px',
      }}>
        <p style={{ color: COLORS.neutral700 }}>Loading...</p>
      </div>
    );
  }

  const getRoleBadge = (role: string) => {
    // Use the RoleBadge component - cast string to MemberRole as this comes from membership data
    return <RoleBadge role={role as MemberRole} size="small" />;
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      active: { color: COLORS.christmasGreen, label: 'Active' },
      pending: { color: COLORS.summerGold, label: 'Pending' },
      suspended: { color: COLORS.neutral700, label: 'Suspended' },
      removed: { color: COLORS.fireRed, label: 'Removed' },
    };
    const badge = badges[status as keyof typeof badges] || badges.pending;
    
    return (
      <span style={{
        padding: '0.25rem 0.75rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: badge.color,
        backgroundColor: badge.color + '20',
        borderRadius: '12px',
      }}>
        {badge.label}
      </span>
    );
  };

  return (
    <div style={{
      padding: '1.5rem',
      border: `1px solid ${COLORS.neutral200}`,
      borderRadius: '12px',
      transition: 'all 0.2s ease',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '0.75rem',
      }}>
        <div>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            color: COLORS.neutral900,
            marginBottom: '0.25rem',
          }}>
            {brigade?.name || 'Unknown Brigade'}
          </h3>
          {brigade?.location && (
            <p style={{
              fontSize: '0.875rem',
              color: COLORS.neutral700,
              margin: 0,
            }}>
              📍 {brigade.location}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {getRoleBadge(membership.role)}
          {getStatusBadge(membership.status)}
        </div>
      </div>

      {membership.status === 'active' && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <Link
            to={`/dashboard/${membership.brigadeId}`}
            style={{
              display: 'inline-block',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: COLORS.fireRed,
              textDecoration: 'none',
              border: `1px solid ${COLORS.fireRed}`,
              borderRadius: '8px',
            }}
          >
            Go to Dashboard →
          </Link>
          <button
            onClick={handleLeaveBrigade}
            disabled={leaving}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: COLORS.neutral700,
              background: 'transparent',
              border: `1px solid ${COLORS.neutral300}`,
              borderRadius: '8px',
              cursor: leaving ? 'not-allowed' : 'pointer',
              opacity: leaving ? 0.7 : 1,
            }}
          >
            {leaving ? 'Leaving...' : 'Leave Brigade'}
          </button>
        </div>
      )}
    </div>
  );
}
