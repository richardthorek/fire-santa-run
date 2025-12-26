# Developer Guide - Membership System

This guide helps developers understand and work with the Fire Santa Run membership system introduced in Phase 6a.

## Architecture Overview

The membership system follows a **multi-tenant, multi-role** architecture:

```
User (1) ←→ (Many) BrigadeMembership (Many) ←→ (1) Brigade
                         ↑
                         │ role: admin | operator | viewer
                         │ status: pending | active | suspended | removed
```

### Key Concepts

1. **User** - Individual account (email + password/OAuth)
2. **Brigade** - Fire service brigade (can be claimed or unclaimed)
3. **Membership** - Link between user and brigade with role
4. **Invitation** - Token-based invitation to join brigade
5. **Verification** - Proof of affiliation for non-.gov.au users

## Role Hierarchy

```
admin > operator > viewer
```

### Role Permissions

**Admin**
- Manage brigade settings
- Invite/remove members
- Promote/demote members
- Create/edit/delete routes
- View all routes
- Access navigation

**Operator**
- Create/edit/delete own routes
- View all brigade routes
- Access navigation
- Cannot manage members

**Viewer**
- View all brigade routes
- View public tracking pages
- Cannot create routes
- Cannot manage members

## Admin Eligibility

Two pathways to become admin:

### Pathway 1: Government Email
```typescript
if (user.email.endsWith('.gov.au')) {
  // Can immediately become admin
  canBecomeAdmin = true;
}
```

### Pathway 2: Site Owner Verification
```typescript
if (user.verifiedBrigades.includes(brigadeId)) {
  // Has been verified by site owner
  canBecomeAdmin = true;
}
```

## Common Workflows

### 1. Brigade Claiming (New Brigade)

```typescript
import { membershipService } from '@/services/membershipService';

async function claimBrigade(userId: string, brigadeId: string) {
  try {
    // Service checks eligibility and creates admin membership
    const result = await membershipService.claimBrigade(userId, brigadeId);
    
    return {
      success: true,
      brigade: result.brigade,
      membership: result.membership
    };
  } catch (error) {
    // Handle eligibility errors
    if (error.message.includes('not eligible')) {
      // User needs .gov.au email or verification
      return { success: false, reason: 'not-eligible' };
    }
    throw error;
  }
}
```

### 2. Inviting New Members

```typescript
import { membershipService } from '@/services/membershipService';

async function inviteNewMember(
  brigadeId: string,
  email: string,
  role: 'operator' | 'viewer',
  invitedBy: string
) {
  try {
    const invitation = await membershipService.inviteMember({
      brigadeId,
      email,
      role,
      invitedBy,
      personalMessage: 'Welcome to the team!'
    });
    
    // Send invitation email (Phase 7)
    await sendInvitationEmail(invitation);
    
    return invitation;
  } catch (error) {
    // Handle errors (duplicate invitation, etc.)
    throw error;
  }
}
```

### 3. Accepting Invitations

```typescript
async function acceptInvitation(token: string, userId: string) {
  try {
    const result = await membershipService.acceptInvitation(token, userId);
    
    return {
      success: true,
      membership: result.membership
    };
  } catch (error) {
    if (error.message.includes('expired')) {
      return { success: false, reason: 'expired' };
    }
    throw error;
  }
}
```

### 4. Promoting to Admin

```typescript
async function promoteToAdmin(
  brigadeId: string,
  userId: string,
  promotedBy: string
) {
  try {
    // Checks admin eligibility (.gov.au or verified)
    const membership = await membershipService.promoteToAdmin(
      brigadeId,
      userId,
      promotedBy
    );
    
    return { success: true, membership };
  } catch (error) {
    if (error.message.includes('not eligible')) {
      // User needs verification first
      return { success: false, reason: 'needs-verification' };
    }
    throw error;
  }
}
```

### 5. Admin Verification Request

```typescript
import { verificationService } from '@/services/verificationService';

async function submitVerificationRequest(
  userId: string,
  brigadeId: string,
  email: string,
  explanation: string,
  evidenceFiles: EvidenceFile[]
) {
  try {
    const request = await verificationService.submitVerificationRequest({
      userId,
      brigadeId,
      email,
      explanation,
      evidenceFiles
    });
    
    // Site owner will review
    return request;
  } catch (error) {
    if (error.message.includes('.gov.au')) {
      // No verification needed for gov emails
      return { success: false, reason: 'no-verification-needed' };
    }
    throw error;
  }
}
```

### 6. Site Owner Review (Admin Only)

```typescript
async function approveVerification(
  requestId: string,
  userId: string,
  reviewedBy: string,
  reviewNotes?: string
) {
  try {
    // Only site owners can call this
    const request = await verificationService.approveVerification(
      requestId,
      userId,
      reviewedBy,
      reviewNotes
    );
    
    // User's verifiedBrigades array updated automatically
    return request;
  } catch (error) {
    throw error;
  }
}
```

## Validation Rules

### Membership Rules

Located in `src/utils/membershipRules.ts`:

```typescript
import {
  canBecomeAdmin,
  canClaimBrigade,
  validateAdminCount,
  canRemoveMember,
  canLeaveBrigade,
  isInvitationValid,
  hasApprovedVerification
} from '@/utils/membershipRules';

// Example: Check if user can become admin
if (await canBecomeAdmin(user, brigadeId)) {
  // Promote to admin
}

// Example: Validate admin removal
if (!(await canRemoveMember(brigade, membership))) {
  throw new Error('Cannot remove last admin');
}
```

### Email Validation

Located in `src/utils/emailValidation.ts`:

```typescript
import {
  isGovernmentEmail,
  matchesAllowedDomains,
  isAutoApproved
} from '@/utils/emailValidation';

// Check if government email
if (isGovernmentEmail(email)) {
  // Auto-approve admin
}

// Check against brigade whitelist
if (matchesAllowedDomains(email, brigade.allowedDomains)) {
  // Auto-approve membership
}
```

### File Validation

Located in `src/utils/fileValidation.ts`:

```typescript
import {
  validateFileType,
  validateFileSize,
  scanForMalware
} from '@/utils/fileValidation';

// Validate evidence file
const file = uploadedFile;

if (!validateFileType(file.type)) {
  throw new Error('Invalid file type. Use JPEG, PNG, HEIC, or PDF');
}

if (!validateFileSize([file], 10 * 1024 * 1024)) {
  throw new Error('Total file size exceeds 10MB');
}

// Scan for malware (placeholder in Phase 6a)
await scanForMalware(file);
```

## UI Integration

### Using Storage Adapter

```typescript
import { storageAdapter } from '@/storage';

// Get user's memberships
const memberships = await storageAdapter.getMembershipsByUser(userId);

// Get brigade members
const members = await storageAdapter.getBrigadeMembers(brigadeId);

// Check if user is admin
const isAdmin = memberships.some(
  m => m.brigadeId === brigadeId && m.role === 'admin' && m.status === 'active'
);
```

### React Context (Future)

```typescript
// AuthContext will provide (Phase 7)
const { user, memberships } = useAuth();

// BrigadeContext will provide
const { brigade, members, isAdmin, isOperator } = useBrigade();
```

## API Integration

### Calling API Endpoints

```typescript
// Register user
const response = await fetch('/api/users/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: generateUUID(),
    email: 'user@example.com',
    name: 'John Doe'
  })
});

// Claim brigade
const claimResponse = await fetch(`/api/brigades/${brigadeId}/claim`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId })
});

// Invite member
const inviteResponse = await fetch(
  `/api/brigades/${brigadeId}/members/invite`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'member@example.com',
      role: 'operator',
      invitedBy: userId
    })
  }
);
```

## Testing

### Unit Testing Services

```typescript
import { describe, it, expect } from 'vitest';
import { membershipService } from '@/services/membershipService';

describe('membershipService', () => {
  it('should allow .gov.au user to claim brigade', async () => {
    const user = createMockUser({ email: 'admin@rfs.nsw.gov.au' });
    const brigade = createMockBrigade({ isClaimed: false });
    
    const result = await membershipService.claimBrigade(user.id, brigade.id);
    
    expect(result.brigade.isClaimed).toBe(true);
    expect(result.membership.role).toBe('admin');
  });
  
  it('should prevent non-.gov.au user without verification from claiming', async () => {
    const user = createMockUser({ email: 'admin@gmail.com' });
    const brigade = createMockBrigade({ isClaimed: false });
    
    await expect(
      membershipService.claimBrigade(user.id, brigade.id)
    ).rejects.toThrow('not eligible');
  });
});
```

### Integration Testing API

```typescript
describe('POST /api/brigades/:id/claim', () => {
  it('should claim brigade with .gov.au email', async () => {
    const user = await createTestUser({ email: 'test@rfs.nsw.gov.au' });
    const brigade = await createTestBrigade({ isClaimed: false });
    
    const response = await fetch(`/api/brigades/${brigade.id}/claim`, {
      method: 'POST',
      body: JSON.stringify({ userId: user.id })
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.brigade.isClaimed).toBe(true);
  });
});
```

## Best Practices

### 1. Always Check Authorization

```typescript
// Before allowing actions
const membership = await storageAdapter.getMembership(brigadeId, userId);

if (!membership || membership.role !== 'admin') {
  throw new Error('Unauthorized');
}
```

### 2. Validate Input

```typescript
// Use validation rules
import { canBecomeAdmin } from '@/utils/membershipRules';

if (role === 'admin' && !(await canBecomeAdmin(user, brigadeId))) {
  throw new Error('User not eligible to become admin');
}
```

### 3. Use Transactions (Future)

```typescript
// When multiple operations must succeed together
try {
  await storageAdapter.saveBrigade(brigade);
  await storageAdapter.saveMembership(membership);
  // Both succeed or both fail
} catch (error) {
  // Rollback if needed
  throw error;
}
```

### 4. Handle Errors Gracefully

```typescript
try {
  await membershipService.inviteMember(...);
} catch (error) {
  if (error.message.includes('already exists')) {
    // Show user-friendly message
    return { success: false, message: 'User already invited' };
  }
  // Log unexpected errors
  console.error('Invitation error:', error);
  throw error;
}
```

## Debugging

### Common Issues

**Issue**: Membership not found
```typescript
// Check both brigade and user IDs
const membership = await storageAdapter.getMembership(brigadeId, userId);
if (!membership) {
  console.log('No membership for', userId, 'in', brigadeId);
}
```

**Issue**: Invitation expired
```typescript
// Check expiration
const invitation = await storageAdapter.getInvitationByToken(token);
if (new Date(invitation.expiresAt) < new Date()) {
  console.log('Invitation expired:', invitation.expiresAt);
}
```

**Issue**: Cannot promote to admin
```typescript
// Check eligibility
const hasGovEmail = user.email.endsWith('.gov.au');
const hasVerification = user.verifiedBrigades.includes(brigadeId);
console.log('Gov email:', hasGovEmail);
console.log('Verification:', hasVerification);
```

### Logging

```typescript
// Enable detailed logging in services
const DEBUG = true;

if (DEBUG) {
  console.log('[membershipService] Claiming brigade:', {
    userId,
    brigadeId,
    hasGovEmail,
    hasVerification
  });
}
```

## Future Enhancements (Phase 7+)

- Email notifications for invitations
- Real-time membership updates via WebSockets
- Bulk invitation import (CSV)
- Member activity logs
- Automatic role expiration
- External identity provider integration (Google, Facebook)
- Two-factor authentication for admins

## Resources

- **MASTER_PLAN.md** - Section 12a: Comprehensive authentication system
- **API_PHASE_6A.md** - Complete API endpoint documentation
- **MIGRATION_GUIDE.md** - Data migration strategies
- **Type definitions** - `src/types/user.ts`, `membership.ts`, `invitation.ts`, `verification.ts`
- **Services** - `src/services/membershipService.ts`, `verificationService.ts`
- **Validation utilities** - `src/utils/membershipRules.ts`, `emailValidation.ts`, `fileValidation.ts`
