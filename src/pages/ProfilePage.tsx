import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';
import { storageAdapter } from '../storage';
import { COLORS } from '../utils/constants';
import type { BrigadeMembership } from '../types/membership';

/**
 * User Profile Page
 * 
 * Displays user information, brigade memberships, and allows profile updates.
 * Automatically creates user profile on first login.
 */
export function ProfilePage() {
  const { user, memberships, isLoading, error, updateProfile } = useUserProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  return (
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
                <p style={{
                  fontSize: '1rem',
                  color: COLORS.neutral900,
                  margin: 0,
                }}>
                  {user.name}
                </p>
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
                <MembershipCard key={membership.id} membership={membership} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper component for membership cards
function MembershipCard({ membership }: { membership: BrigadeMembership }) {
  const [brigade, setBrigade] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
    const badges = {
      admin: { color: COLORS.fireRed, label: 'Admin' },
      operator: { color: COLORS.summerGold, label: 'Operator' },
      viewer: { color: COLORS.neutral700, label: 'Viewer' },
    };
    const badge = badges[role as keyof typeof badges] || badges.viewer;
    
    return (
      <span style={{
        padding: '0.25rem 0.75rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'white',
        backgroundColor: badge.color,
        borderRadius: '12px',
      }}>
        {badge.label}
      </span>
    );
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
        <Link
          to={`/dashboard/${membership.brigadeId}`}
          style={{
            display: 'inline-block',
            marginTop: '0.5rem',
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
      )}
    </div>
  );
}
