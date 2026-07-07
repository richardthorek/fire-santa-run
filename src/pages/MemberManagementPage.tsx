/**
 * Member Management Page
 * 
 * Allows brigade admins to manage members, send invitations, and handle approvals.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context';
import { useUserProfile } from '../hooks/useUserProfile';
import { storageAdapter } from '../storage';
import { MembershipService } from '../services/membershipService';
import { RoleBadge, SEO, AppLayout } from '../components';
import { canInviteMembers, canManageMembers, canApproveMembership } from '../utils/permissions';
import type { BrigadeMembership } from '../types/membership';
import type { MemberInvitation } from '../types/invitation';
import type { User } from '../types/user';
import type { Brigade } from '../storage/types';
import { COLORS } from '../utils/constants';
import {
  logMemberInvited,
  logMemberApproved,
  logMemberRemoved,
  logRoleChanged,
  logAuditEvent,
} from '../utils/auditLog';

const membershipService = new MembershipService(storageAdapter);

/**
 * MemberManagementPage
 * 
 * Displays list of brigade members, pending invitations, and approval requests.
 */
export function MemberManagementPage() {
  const { brigadeId } = useParams<{ brigadeId: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { memberships } = useUserProfile();
  const [members, setMembers] = useState<BrigadeMembership[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<MemberInvitation[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<BrigadeMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [brigade, setBrigade] = useState<Brigade | null>(null);

  // Get current user's membership in this brigade
  const currentMembership = memberships.find(m => m.brigadeId === brigadeId);

  // Check permissions
  const hasInvitePermission = currentMembership ? canInviteMembers(currentMembership) : false;
  const hasManagePermission = currentMembership ? canManageMembers(currentMembership) : false;
  const hasApprovalPermission = currentMembership ? canApproveMembership(currentMembership) : false;

  const loadData = useCallback(async () => {
    if (!brigadeId) return;

    setLoading(true);
    setError(null);

    try {
      const [brigadeData, membersData, invitationsData, approvalsData] = await Promise.all([
        storageAdapter.getBrigade(brigadeId),
        storageAdapter.getMembershipsByBrigade(brigadeId),
        storageAdapter.getPendingInvitationsByBrigade(brigadeId),
        storageAdapter.getPendingMembershipsByBrigade(brigadeId),
      ]);

      setBrigade(brigadeData);
      setMembers(membersData.filter(m => m.status === 'active' || m.status === 'suspended'));
      setPendingInvitations(invitationsData);
      setPendingApprovals(approvalsData);
    } catch (err) {
      console.error('Failed to load member data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load member data');
    } finally {
      setLoading(false);
    }
  }, [brigadeId]);

  useEffect(() => {
    if (!brigadeId) {
      navigate('/profile');
      return;
    }

    loadData();
  }, [brigadeId, loadData, navigate]);

  const handleApproveMembership = async (membership: BrigadeMembership) => {
    if (!authUser || !brigadeId) return;

    try {
      // Get target user email
      const targetUser = await storageAdapter.getUser(membership.userId);
      
      const result = await membershipService.approveMembership(authUser.id, brigadeId, membership.userId);
      if (result.success) {
        logMemberApproved(
          authUser.id,
          authUser.email,
          membership.userId,
          targetUser?.email || 'unknown',
          brigadeId
        );
        await loadData();
      } else {
        alert(result.error || 'Failed to approve membership');
      }
    } catch (err) {
      console.error('Failed to approve membership:', err);
      alert('Failed to approve membership');
    }
  };

  const handleRejectMembership = async (membership: BrigadeMembership) => {
    if (!authUser || !brigadeId) return;

    const reason = prompt('Please provide a reason for rejection (optional):');
    if (reason === null) return; // User cancelled

    try {
      // Get target user email
      const targetUser = await storageAdapter.getUser(membership.userId);
      
      const result = await membershipService.rejectMembership(authUser.id, brigadeId, membership.userId, reason || undefined);
      if (result.success) {
        logMemberRemoved(
          authUser.id,
          authUser.email,
          membership.userId,
          targetUser?.email || 'unknown',
          brigadeId,
          reason || undefined
        );
        await loadData();
      } else {
        alert(result.error || 'Failed to reject membership');
      }
    } catch (err) {
      console.error('Failed to reject membership:', err);
      alert('Failed to reject membership');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '1rem' }}>⏳</div>
        <p>Loading members...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '1rem' }}>⚠️</div>
        <p style={{ color: COLORS.error }}>{error}</p>
        <button
          onClick={loadData}
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1.5rem',
            background: COLORS.primary,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!brigade) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Brigade not found</p>
      </div>
    );
  }

  return (
    <>
      <SEO title={`Member Management - ${brigade.name}`} description="Manage brigade members and invitations" />
      <AppLayout>
      <div style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        backgroundColor: '#fafafa',
      }}>
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <div>
              <h1 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '2rem', color: COLORS.primary }}>
                👥 Member Management
              </h1>
              <p style={{ margin: 0, color: '#616161' }}>
                {brigade.name}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {hasManagePermission && (
              <Link
                to={`/dashboard/${brigadeId}/settings`}
                style={{
                  padding: '0.875rem 1.5rem',
                  background: 'white',
                  color: COLORS.primary,
                  border: `2px solid ${COLORS.primary}`,
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  textDecoration: 'none',
                }}
              >
                ⚙️ Brigade Settings
              </Link>
            )}
            {hasInvitePermission && (
              <button
                onClick={() => setShowInviteModal(true)}
                style={{
                  padding: '0.875rem 1.5rem',
                  background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(211, 47, 47, 0.3)',
                }}
              >
                ✉️ Invite Member
              </button>
            )}
            </div>
          </div>

          {/* Pending Approvals Section (Admin Only) */}
          {hasApprovalPermission && pendingApprovals.length > 0 && (
            <div style={{
              backgroundColor: '#FFF9E6',
              border: '2px solid #FFA726',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '2rem',
            }}>
              <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem', color: '#F57C00' }}>
                ⏳ Pending Approvals ({pendingApprovals.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {pendingApprovals.map(membership => (
                  <PendingApprovalCard
                    key={membership.id}
                    membership={membership}
                    onApprove={handleApproveMembership}
                    onReject={handleRejectMembership}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pending Invitations Section */}
          {pendingInvitations.length > 0 && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '2rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}>
              <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem', color: '#616161' }}>
                📨 Pending Invitations ({pendingInvitations.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {pendingInvitations.map(invitation => (
                  <PendingInvitationCard
                    key={invitation.id}
                    invitation={invitation}
                    onCancel={async () => {
                      if (!confirm('Cancel this invitation?')) return;
                      
                      try {
                        // Update invitation status to cancelled
                        invitation.status = 'cancelled';
                        invitation.updatedAt = new Date().toISOString();
                        await storageAdapter.saveInvitation(invitation);
                        await loadData();
                      } catch (err) {
                        console.error('Failed to cancel invitation:', err);
                        alert('Failed to cancel invitation');
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Active Members Section */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem', color: '#616161' }}>
              ✅ Active Members ({members.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {members.map(membership => (
                <MemberCard
                  key={membership.id}
                  membership={membership}
                  currentUserId={authUser?.id}
                  hasManagePermission={hasManagePermission}
                  onRemove={async () => {
                    if (!authUser || !brigadeId) return;
                    if (!confirm('Are you sure you want to remove this member?')) return;
                    
                    try {
                      const targetUser = await storageAdapter.getUser(membership.userId);
                      const result = await membershipService.removeMember(authUser.id, brigadeId, membership.userId);
                      if (result.success) {
                        logMemberRemoved(
                          authUser.id,
                          authUser.email,
                          membership.userId,
                          targetUser?.email || 'unknown',
                          brigadeId
                        );
                        await loadData();
                      } else {
                        alert(result.error || 'Failed to remove member');
                      }
                    } catch (err) {
                      console.error('Failed to remove member:', err);
                      alert('Failed to remove member');
                    }
                  }}
                  onPromote={async () => {
                    if (!authUser || !brigadeId) return;
                    if (!confirm('Promote this member to admin? They will have full brigade management permissions.')) return;

                    try {
                      const targetUser = await storageAdapter.getUser(membership.userId);
                      const result = await membershipService.promoteToAdmin(authUser.id, brigadeId, membership.userId);
                      if (result.success) {
                        logRoleChanged(
                          authUser.id,
                          authUser.email,
                          membership.userId,
                          targetUser?.email || 'unknown',
                          brigadeId,
                          membership.role,
                          'admin'
                        );
                        await loadData();
                      } else {
                        alert(result.error || 'Failed to promote member');
                      }
                    } catch (err) {
                      console.error('Failed to promote member:', err);
                      alert('Failed to promote member');
                    }
                  }}
                  onDemote={async () => {
                    if (!authUser || !brigadeId) return;
                    if (!confirm('Demote this admin to operator? They will lose admin permissions.')) return;

                    try {
                      const targetUser = await storageAdapter.getUser(membership.userId);
                      const result = await membershipService.demoteFromAdmin(authUser.id, brigadeId, membership.userId);
                      if (result.success) {
                        logRoleChanged(
                          authUser.id,
                          authUser.email,
                          membership.userId,
                          targetUser?.email || 'unknown',
                          brigadeId,
                          'admin',
                          'operator'
                        );
                        await loadData();
                      } else {
                        alert(result.error || 'Failed to demote admin');
                      }
                    } catch (err) {
                      console.error('Failed to demote admin:', err);
                      alert('Failed to demote admin');
                    }
                  }}
                  onSuspend={async () => {
                    if (!authUser || !brigadeId) return;
                    if (!confirm('Suspend this member? They will lose access until reactivated.')) return;

                    try {
                      const targetUser = await storageAdapter.getUser(membership.userId);
                      const result = await membershipService.suspendMember(authUser.id, brigadeId, membership.userId);
                      if (result.success) {
                        logAuditEvent('membership.removed', `${authUser.email} suspended ${targetUser?.email || 'unknown'}`, {
                          userId: authUser.id,
                          userEmail: authUser.email,
                          brigadeId,
                          targetUserId: membership.userId,
                          metadata: { action: 'suspend', targetEmail: targetUser?.email },
                        });
                        await loadData();
                      } else {
                        alert(result.error || 'Failed to suspend member');
                      }
                    } catch (err) {
                      console.error('Failed to suspend member:', err);
                      alert('Failed to suspend member');
                    }
                  }}
                  onReactivate={async () => {
                    if (!authUser || !brigadeId) return;

                    try {
                      const targetUser = await storageAdapter.getUser(membership.userId);
                      const result = await membershipService.reactivateMember(authUser.id, brigadeId, membership.userId);
                      if (result.success) {
                        logAuditEvent('membership.approved', `${authUser.email} reactivated ${targetUser?.email || 'unknown'}`, {
                          userId: authUser.id,
                          userEmail: authUser.email,
                          brigadeId,
                          targetUserId: membership.userId,
                          metadata: { action: 'reactivate', targetEmail: targetUser?.email },
                        });
                        await loadData();
                      } else {
                        alert(result.error || 'Failed to reactivate member');
                      }
                    } catch (err) {
                      console.error('Failed to reactivate member:', err);
                      alert('Failed to reactivate member');
                    }
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && authUser && (
        <InviteModal
          brigadeId={brigadeId!}
          currentUser={authUser}
          onClose={() => setShowInviteModal(false)}
          onSuccess={async () => {
            setShowInviteModal(false);
            await loadData();
          }}
        />
      )}
      </AppLayout>
    </>
  );
}

// Helper component for pending approval cards
function PendingApprovalCard({
  membership,
  onApprove,
  onReject,
}: {
  membership: BrigadeMembership;
  onApprove: (membership: BrigadeMembership) => void;
  onReject: (membership: BrigadeMembership) => void;
}) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    storageAdapter.getUser(membership.userId).then(setUser);
  }, [membership.userId]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem',
      backgroundColor: 'white',
      borderRadius: '8px',
      border: '1px solid #E0E0E0',
    }}>
      <div>
        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
          {user?.name || 'Loading...'}
        </div>
        <div style={{ fontSize: '0.875rem', color: '#616161' }}>
          {user?.email}
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <RoleBadge role={membership.role} size="small" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => onApprove(membership)}
          style={{
            padding: '0.5rem 1rem',
            background: COLORS.success,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ✓ Approve
        </button>
        <button
          onClick={() => onReject(membership)}
          style={{
            padding: '0.5rem 1rem',
            background: COLORS.error,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ✗ Reject
        </button>
      </div>
    </div>
  );
}

// Helper component for pending invitation cards
function PendingInvitationCard({
  invitation,
  onCancel,
}: {
  invitation: MemberInvitation;
  onCancel: () => void;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem',
      backgroundColor: '#F5F5F5',
      borderRadius: '8px',
      border: '1px solid #E0E0E0',
    }}>
      <div>
        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
          {invitation.email}
        </div>
        <div style={{ fontSize: '0.875rem', color: '#616161' }}>
          Invited {new Date(invitation.invitedAt).toLocaleDateString()}
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <RoleBadge role={invitation.role} size="small" />
        </div>
      </div>
      <button
        onClick={onCancel}
        style={{
          padding: '0.5rem 1rem',
          background: '#EEEEEE',
          color: '#616161',
          border: '1px solid #E0E0E0',
          borderRadius: '8px',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Cancel
      </button>
    </div>
  );
}

// Helper component for active member cards
function MemberCard({
  membership,
  currentUserId,
  hasManagePermission,
  onRemove,
  onPromote,
  onDemote,
  onSuspend,
  onReactivate,
}: {
  membership: BrigadeMembership;
  currentUserId?: string;
  hasManagePermission: boolean;
  onRemove: () => void;
  onPromote: () => void;
  onDemote: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
}) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    storageAdapter.getUser(membership.userId).then(setUser);
  }, [membership.userId]);

  const isCurrentUser = currentUserId === membership.userId;
  const isSuspended = membership.status === 'suspended';

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem',
      backgroundColor: isSuspended ? '#FFF3E0' : '#F5F5F5',
      borderRadius: '8px',
      border: `1px solid ${isSuspended ? '#FFB74D' : '#E0E0E0'}`,
      opacity: isSuspended ? 0.85 : 1,
    }}>
      <div>
        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
          {user?.name || 'Loading...'} {isCurrentUser && '(You)'}
          {isSuspended && (
            <span style={{
              marginLeft: '0.5rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              color: '#B26A00',
              background: '#FFE0B2',
              padding: '0.15rem 0.5rem',
              borderRadius: '999px',
              verticalAlign: 'middle',
            }}>
              ⏸ SUSPENDED
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.875rem', color: '#616161' }}>
          {user?.email}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#9E9E9E', marginTop: '0.25rem' }}>
          {membership.joinedAt && <>Joined {new Date(membership.joinedAt).toLocaleDateString()}</>}
          {user?.lastLoginAt && <>{membership.joinedAt ? ' · ' : ''}Last login {new Date(user.lastLoginAt).toLocaleDateString()}</>}
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <RoleBadge role={membership.role} size="small" />
        </div>
      </div>
      {hasManagePermission && !isCurrentUser && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {isSuspended ? (
            <button
              onClick={onReactivate}
              style={{
                padding: '0.5rem 1rem',
                background: COLORS.success,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ▶️ Reactivate
            </button>
          ) : membership.role !== 'admin' ? (
            <button
              onClick={onSuspend}
              style={{
                padding: '0.5rem 1rem',
                background: '#FB8C00',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ⏸ Suspend
            </button>
          ) : null}
          {!isSuspended && membership.role !== 'admin' && (
            <button
              onClick={onPromote}
              style={{
                padding: '0.5rem 1rem',
                background: COLORS.secondary,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ⬆️ Promote
            </button>
          )}
          {membership.role === 'admin' && (
            <button
              onClick={onDemote}
              style={{
                padding: '0.5rem 1rem',
                background: '#9E9E9E',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ⬇️ Demote
            </button>
          )}
          <button
            onClick={onRemove}
            style={{
              padding: '0.5rem 1rem',
              background: COLORS.error,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🗑️ Remove
          </button>
        </div>
      )}
    </div>
  );
}

// Invite modal component
function InviteModal({
  brigadeId,
  currentUser,
  onClose,
  onSuccess,
}: {
  brigadeId: string;
  currentUser: { id: string; email: string; name?: string };
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'operator' | 'viewer'>('operator');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const result = await membershipService.inviteMember(
        currentUser.id,
        brigadeId,
        email.trim(),
        role,
        message.trim() || undefined
      );

      if (result.success) {
        logMemberInvited(currentUser.id, currentUser.email, email.trim(), brigadeId, role);
        onSuccess();
      } else {
        setError(result.error || 'Failed to send invitation');
      }
    } catch (err) {
      console.error('Failed to send invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2rem',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', color: COLORS.primary }}>
          ✉️ Invite Member
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="email"
              style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@example.com"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #E0E0E0',
                borderRadius: '8px',
                fontSize: '1rem',
              }}
              required
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="role"
              style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}
            >
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'operator' | 'viewer')}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #E0E0E0',
                borderRadius: '8px',
                fontSize: '1rem',
              }}
            >
              <option value="operator">Operator - Can create and manage routes</option>
              <option value="viewer">Viewer - Can view routes only</option>
            </select>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="message"
              style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}
            >
              Personal Message (Optional)
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message to the invitation..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #E0E0E0',
                borderRadius: '8px',
                fontSize: '1rem',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: '#FFEBEE',
                color: COLORS.error,
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#EEEEEE',
                color: '#616161',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: sending ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              style={{
                padding: '0.75rem 1.5rem',
                background: sending
                  ? '#BDBDBD'
                  : `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: sending ? 'not-allowed' : 'pointer',
              }}
            >
              {sending ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
