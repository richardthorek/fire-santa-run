/**
 * Invitation Acceptance Page
 * 
 * Allows users to accept or decline brigade membership invitations.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context';
import { storageAdapter } from '../storage';
import { MembershipService } from '../services/membershipService';
import { RoleBadge, SEO } from '../components';
import type { MemberInvitation } from '../types/invitation';
import type { User } from '../types/user';
import { COLORS } from '../utils/constants';
import { isInvitationValid } from '../utils/membershipRules';

const membershipService = new MembershipService(storageAdapter);

/**
 * InvitationAcceptancePage
 * 
 * Displays invitation details and allows the user to accept or decline.
 */
export function InvitationAcceptancePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user: authUser, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [invitation, setInvitation] = useState<MemberInvitation | null>(null);
  const [brigade, setBrigade] = useState<any>(null);
  const [inviter, setInviter] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      // Redirect to login with return URL
      navigate(`/login?returnUrl=/invitations/${token}`);
      return;
    }

    if (!authLoading && isAuthenticated && token) {
      loadInvitation();
    }
  }, [authLoading, isAuthenticated, token]);

  const loadInvitation = async () => {
    if (!token) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    try {
      const invitationData = await storageAdapter.getInvitationByToken(token);
      
      if (!invitationData) {
        setError('Invitation not found. It may have expired or been cancelled.');
        setLoading(false);
        return;
      }

      // Check if invitation is valid
      const validCheck = isInvitationValid(invitationData);
      if (!validCheck.valid) {
        setError(validCheck.error || 'This invitation is no longer valid');
        setLoading(false);
        return;
      }

      setInvitation(invitationData);

      // Load brigade and inviter details
      const [brigadeData, inviterData] = await Promise.all([
        storageAdapter.getBrigade(invitationData.brigadeId),
        storageAdapter.getUser(invitationData.invitedBy),
      ]);

      setBrigade(brigadeData);
      setInviter(inviterData);
    } catch (err) {
      console.error('Failed to load invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to load invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!authUser || !invitation) return;

    setAccepting(true);
    setError(null);

    try {
      const result = await membershipService.acceptInvitation(authUser.id, invitation.token);
      
      if (result.success) {
        // Redirect to brigade dashboard
        navigate(`/dashboard/${invitation.brigadeId}`, {
          state: {
            message: `Welcome to ${brigade?.name || 'the brigade'}!`,
            messageType: 'success',
          },
        });
      } else {
        setError(result.error || 'Failed to accept invitation');
      }
    } catch (err) {
      console.error('Failed to accept invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!invitation) return;

    if (!confirm('Are you sure you want to decline this invitation?')) {
      return;
    }

    setDeclining(true);
    setError(null);

    try {
      // Update invitation status to declined
      invitation.status = 'declined';
      invitation.updatedAt = new Date().toISOString();
      await storageAdapter.saveInvitation(invitation);

      // Redirect to profile with message
      navigate('/profile', {
        state: {
          message: 'Invitation declined',
          messageType: 'info',
        },
      });
    } catch (err) {
      console.error('Failed to decline invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to decline invitation');
    } finally {
      setDeclining(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '2rem',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>⏳</div>
          <p>Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <>
        <SEO title="Invitation" description="Brigade membership invitation" />
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          padding: '2rem',
          backgroundColor: '#fafafa',
        }}>
          <div style={{
            maxWidth: '600px',
            width: '100%',
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '3rem',
            boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '64px', marginBottom: '1rem' }}>⚠️</div>
            <h1 style={{ fontSize: '1.75rem', color: COLORS.error, marginBottom: '1rem' }}>
              Invalid Invitation
            </h1>
            <p style={{ color: '#616161', marginBottom: '2rem' }}>
              {error}
            </p>
            <button
              onClick={() => navigate('/profile')}
              style={{
                padding: '0.875rem 1.5rem',
                background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Go to Profile
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!invitation || !brigade) {
    return null;
  }

  return (
    <>
      <SEO title={`Invitation to ${brigade.name}`} description="Brigade membership invitation" />
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '2rem',
        backgroundColor: '#fafafa',
      }}>
        <div style={{
          maxWidth: '600px',
          width: '100%',
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '3rem',
          boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '64px', marginBottom: '1rem' }}>✉️</div>
            <h1 style={{ fontSize: '1.75rem', color: COLORS.primary, marginBottom: '0.5rem' }}>
              Brigade Invitation
            </h1>
            <p style={{ color: '#616161' }}>
              You've been invited to join a fire brigade
            </p>
          </div>

          {/* Brigade Details */}
          <div style={{
            backgroundColor: '#F5F5F5',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2rem',
          }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#212121' }}>
              {brigade.name}
            </h2>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              fontSize: '0.875rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#616161' }}>📍</span>
                <span>{brigade.location}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#616161' }}>👤</span>
                <span>Invited by {inviter?.name || inviter?.email || 'Unknown'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#616161' }}>🎯</span>
                <span>Role: </span>
                <RoleBadge role={invitation.role} size="small" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#616161' }}>⏰</span>
                <span>Expires {new Date(invitation.expiresAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Personal Message */}
          {invitation.personalMessage && (
            <div style={{
              backgroundColor: '#FFF9E6',
              border: '2px solid #FFA726',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '2rem',
            }}>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#F57C00' }}>
                Personal Message:
              </div>
              <div style={{ fontSize: '0.875rem', color: '#424242', fontStyle: 'italic' }}>
                "{invitation.personalMessage}"
              </div>
            </div>
          )}

          {/* Role Description */}
          <div style={{
            backgroundColor: '#E3F2FD',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '2rem',
            fontSize: '0.875rem',
          }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#1976D2' }}>
              {invitation.role === 'operator' ? '🎯 Operator Role' : '👁️ Viewer Role'}
            </div>
            <div style={{ color: '#424242' }}>
              {invitation.role === 'operator' 
                ? 'Can create, edit, and publish Santa Run routes. Can also start navigation on event day.'
                : 'Can view routes and track progress but cannot create or modify routes.'}
            </div>
          </div>

          {/* Approval Notice */}
          {brigade.requireManualApproval && (
            <div style={{
              backgroundColor: '#FFF9E6',
              border: '1px solid #FFB74D',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '2rem',
              fontSize: '0.875rem',
            }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: '#F57C00' }}>
                ℹ️ Admin Approval Required
              </div>
              <div style={{ color: '#616161' }}>
                Your membership will be pending until a brigade admin approves it.
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            marginTop: '2rem',
          }}>
            <button
              onClick={handleDecline}
              disabled={declining || accepting}
              style={{
                flex: 1,
                padding: '1rem',
                background: '#EEEEEE',
                color: '#616161',
                border: '1px solid #E0E0E0',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: (declining || accepting) ? 'not-allowed' : 'pointer',
              }}
            >
              {declining ? 'Declining...' : 'Decline'}
            </button>
            <button
              onClick={handleAccept}
              disabled={accepting || declining}
              style={{
                flex: 1,
                padding: '1rem',
                background: (accepting || declining)
                  ? '#BDBDBD'
                  : `linear-gradient(135deg, ${COLORS.success} 0%, #2E7D32 100%)`,
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: (accepting || declining) ? 'not-allowed' : 'pointer',
                boxShadow: (accepting || declining) ? 'none' : '0 4px 12px rgba(67, 160, 71, 0.3)',
              }}
            >
              {accepting ? 'Accepting...' : '✓ Accept Invitation'}
            </button>
          </div>

          {/* User Info */}
          <div style={{
            marginTop: '2rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid #E0E0E0',
            fontSize: '0.875rem',
            color: '#9E9E9E',
            textAlign: 'center',
          }}>
            Logged in as {authUser?.email}
          </div>
        </div>
      </div>
    </>
  );
}
