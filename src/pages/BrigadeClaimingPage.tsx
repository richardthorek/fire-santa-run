/**
 * Brigade Claiming Page
 * 
 * Allows users to claim unclaimed brigades from the RFS dataset.
 * Requires .gov.au email for immediate claiming or verification request for others.
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';
import { searchStationsByName, getStationsByState } from '../utils/rfsData';
import { storageAdapter } from '../storage';
import { MembershipService } from '../services/membershipService';
import { isGovernmentEmail } from '../utils/emailValidation';
import { COLORS } from '../utils/constants';
import type { RFSStation } from '../types/rfs';
import type { Brigade } from '../types';

const membershipService = new MembershipService(storageAdapter);

/**
 * BrigadeClaimingPage
 * 
 * Allows users to search for and claim unclaimed brigades.
 */
export function BrigadeClaimingPage() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useUserProfile();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [stations, setStations] = useState<RFSStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const states = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
  const hasGovEmail = user ? isGovernmentEmail(user.email) : false;

  // Search for stations by name
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const results = await searchStationsByName(searchQuery, 20);
      setStations(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search stations');
    } finally {
      setLoading(false);
    }
  };

  // Filter by state
  const handleStateFilter = async (state: string) => {
    setSelectedState(state);
    setLoading(true);
    setError(null);

    try {
      const results = await getStationsByState(state);
      setStations(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stations');
    } finally {
      setLoading(false);
    }
  };

  // Claim a brigade
  const handleClaimBrigade = async (station: RFSStation) => {
    if (!user) {
      setError('You must be logged in to claim a brigade');
      return;
    }

    setClaiming(station.id.toString());
    setError(null);

    try {
      // Check if brigade already exists
      let brigade = await storageAdapter.getBrigadeByRFSId(station.id.toString());

      if (!brigade) {
        // Create new brigade from RFS station
        brigade = {
          id: self.crypto.randomUUID(),
          name: station.name,
          location: `${station.suburb || ''}, ${station.state}`.trim(),
          contactEmail: user.email,
          rfsStationId: station.id.toString(),
          isClaimed: false,
          requireManualApproval: !hasGovEmail, // Auto-approve for .gov.au emails
          allowedDomains: [],
          allowedEmails: [],
          adminUserIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await storageAdapter.saveBrigade(brigade);
      }

      // Check if already claimed
      if (brigade.isClaimed) {
        setError('This brigade has already been claimed');
        setClaiming(null);
        return;
      }

      // Attempt to claim the brigade
      const result = await membershipService.claimBrigade(user, brigade.id);

      if (!result.success) {
        setError(result.error || 'Failed to claim brigade');
        setClaiming(null);
        return;
      }

      // Success! Refresh profile to get new membership
      await refreshProfile();

      // Redirect to brigade dashboard
      navigate(`/dashboard/${brigade.id}`, {
        state: { 
          message: `Successfully claimed ${brigade.name}!`,
          messageType: 'success',
        },
      });
    } catch (err) {
      console.error('Failed to claim brigade:', err);
      setError(err instanceof Error ? err.message : 'Failed to claim brigade');
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: COLORS.neutral50,
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <Link
            to="/profile"
            style={{
              color: COLORS.fireRed,
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
              display: 'inline-block',
              marginBottom: '1rem',
            }}
          >
            ← Back to Profile
          </Link>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: COLORS.neutral900,
            marginBottom: '0.5rem',
          }}>
            Claim Your Brigade
          </h1>
          <p style={{
            fontSize: '1rem',
            color: COLORS.neutral700,
            marginBottom: '1rem',
          }}>
            Search for your Rural Fire Service brigade and claim it to start planning Santa runs
          </p>

          {/* Email validation info */}
          {user && (
            <div style={{
              padding: '1rem',
              backgroundColor: hasGovEmail ? COLORS.christmasGreen + '20' : COLORS.summerGold + '40',
              borderRadius: '12px',
              marginTop: '1rem',
            }}>
              <p style={{
                fontSize: '0.875rem',
                color: COLORS.neutral800,
                margin: 0,
              }}>
                {hasGovEmail ? (
                  <>
                    ✅ <strong>{user.email}</strong> - Your .gov.au email allows instant brigade claiming
                  </>
                ) : (
                  <>
                    ℹ️ <strong>{user.email}</strong> - Non-government emails require verification for admin access.
                    You'll need to submit proof of membership after claiming.
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Search Section */}
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
            Search for Your Brigade
          </h2>

          {/* Search by name */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: COLORS.neutral700,
              marginBottom: '0.5rem',
            }}>
              Brigade Name
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter brigade name (e.g., Warrandyte, Blue Mountains)"
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: `1px solid ${COLORS.neutral300}`,
                  borderRadius: '8px',
                }}
              />
              <button
                onClick={handleSearch}
                disabled={loading || !searchQuery.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'white',
                  background: `linear-gradient(135deg, ${COLORS.fireRed} 0%, ${COLORS.fireRedDark} 100%)`,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading || !searchQuery.trim() ? 'not-allowed' : 'pointer',
                  opacity: loading || !searchQuery.trim() ? 0.7 : 1,
                }}
              >
                Search
              </button>
            </div>
          </div>

          {/* Filter by state */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: COLORS.neutral700,
              marginBottom: '0.5rem',
            }}>
              Or Filter by State
            </label>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}>
              {states.map((state) => (
                <button
                  key={state}
                  onClick={() => handleStateFilter(state)}
                  disabled={loading}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: selectedState === state ? 'white' : COLORS.fireRed,
                    background: selectedState === state 
                      ? `linear-gradient(135deg, ${COLORS.fireRed} 0%, ${COLORS.fireRedDark} 100%)`
                      : 'white',
                    border: `1px solid ${COLORS.fireRed}`,
                    borderRadius: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {state}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: COLORS.fireRedLight + '20',
              borderLeft: `4px solid ${COLORS.fireRed}`,
              borderRadius: '8px',
            }}>
              <p style={{
                fontSize: '0.875rem',
                color: COLORS.fireRedDark,
                margin: 0,
              }}>
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Results Section */}
        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🚒</div>
            <p>Searching brigades...</p>
          </div>
        ) : stations.length > 0 ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            padding: '2rem',
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: COLORS.neutral900,
              marginBottom: '1.5rem',
            }}>
              {stations.length} Brigade{stations.length !== 1 ? 's' : ''} Found
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {stations.map((station) => (
                <BrigadeCard
                  key={station.id}
                  station={station}
                  onClaim={handleClaimBrigade}
                  claiming={claiming === station.id.toString()}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Helper component for brigade cards
interface BrigadeCardProps {
  station: RFSStation;
  onClaim: (station: RFSStation) => void;
  claiming: boolean;
}

function BrigadeCard({ station, onClaim, claiming }: BrigadeCardProps) {
  const [brigadeStatus, setBrigadeStatus] = useState<'checking' | 'unclaimed' | 'claimed'>('checking');

  useEffect(() => {
    const checkBrigade = async () => {
      try {
        const brigade = await storageAdapter.getBrigadeByRFSId(station.id.toString());
        setBrigadeStatus(brigade?.isClaimed ? 'claimed' : 'unclaimed');
      } catch (err) {
        console.error('Failed to check brigade status:', err);
        setBrigadeStatus('unclaimed');
      }
    };
    checkBrigade();
  }, [station.id]);

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
        gap: '1rem',
      }}>
        <div style={{ flex: 1 }}>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            color: COLORS.neutral900,
            marginBottom: '0.5rem',
          }}>
            {station.name}
          </h3>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}>
            {station.address && (
              <p style={{
                fontSize: '0.875rem',
                color: COLORS.neutral700,
                margin: 0,
              }}>
                📍 {station.address}
              </p>
            )}
            {station.suburb && (
              <p style={{
                fontSize: '0.875rem',
                color: COLORS.neutral700,
                margin: 0,
              }}>
                {station.suburb}, {station.state} {station.postcode}
              </p>
            )}
            {station.operationalStatus && (
              <p style={{
                fontSize: '0.875rem',
                color: COLORS.neutral700,
                margin: 0,
              }}>
                Status: {station.operationalStatus}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          {brigadeStatus === 'checking' ? (
            <span style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              color: COLORS.neutral700,
            }}>
              Checking...
            </span>
          ) : brigadeStatus === 'claimed' ? (
            <span style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: COLORS.neutral700,
              backgroundColor: COLORS.neutral200,
              borderRadius: '8px',
            }}>
              Already Claimed
            </span>
          ) : (
            <button
              onClick={() => onClaim(station)}
              disabled={claiming}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'white',
                background: `linear-gradient(135deg, ${COLORS.christmasGreen} 0%, ${COLORS.eucalyptusGreen} 100%)`,
                border: 'none',
                borderRadius: '8px',
                cursor: claiming ? 'not-allowed' : 'pointer',
                opacity: claiming ? 0.7 : 1,
              }}
            >
              {claiming ? 'Claiming...' : 'Claim Brigade'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
