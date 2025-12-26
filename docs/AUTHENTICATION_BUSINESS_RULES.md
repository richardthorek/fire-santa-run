# Fire Santa Run - Authentication Business Rules Reference

**Document Status:** Planning Document (Pre-Implementation)  
**Related Phases:** Phase 6a (Data Schema Updates), Phase 7 (Authentication Implementation)  
**Last Updated:** December 2024

---

## Executive Summary

This document provides a comprehensive reference for all business rules, constraints, and workflows related to user authentication, brigade management, and membership administration in the Fire Santa Run application.

### Key Principles

1. **Self-Service First:** Members can invite new members without admin intervention
2. **Admin Governance:** Critical actions (promotions, removals) require admin privileges
3. **Flexible Verification:** Admins verified via .gov.au email OR manual verification with membership evidence
4. **Multi-Brigade Support:** Users can belong to multiple brigades with different roles
5. **Always-Admin Rule:** Every brigade must have 1-2 admins at all times

---

## 1. Email Validation & Admin Verification Rules

### Admin Verification Pathways

**Two methods to become a brigade admin:**

#### Method 1: Automatic Verification (.gov.au Email)
For states/organizations that issue government email addresses to volunteers:

**Validation:**
```typescript
function isGovernmentEmail(email: string): boolean {
  return /\.gov\.au$/i.test(email);
}

function canAutoVerifyAsAdmin(email: string): boolean {
  return isGovernmentEmail(email);
}
```

**Instant admin eligibility:**
- ✅ Users with `.gov.au` email can immediately claim unclaimed brigades
- ✅ Users with `.gov.au` email can be instantly promoted to admin by existing admins
- ✅ No manual verification required

#### Method 2: Manual Verification (Membership Evidence Upload)
For states/organizations that do NOT issue email addresses to volunteer brigade members:

**Process:**
1. User without .gov.au email requests admin verification
2. User uploads evidence of brigade membership:
   - Official ID card or badge (photo)
   - Membership certificate (screenshot/photo)
   - Official letter from brigade captain/chief
   - Payslip showing brigade employment
   - Training certificates
   - Any official documentation proving brigade membership
3. Submission sent to **site owner** (super admin) for review
4. Site owner validates evidence and approves/rejects
5. If approved: User marked as "verified member" and can become admin

**Verification Request Data Model:**
```typescript
interface AdminVerificationRequest {
  id: string;
  userId: string;
  brigadeId: string;
  email: string;                    // User's email (not .gov.au)
  requestedRole: 'admin';           // Always admin for verification requests
  
  // Evidence
  evidenceFiles: EvidenceFile[];    // Uploaded proof documents
  explanation: string;              // User's explanation (max 500 chars)
  
  // Status
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  
  // Review
  reviewedBy?: string;              // Site owner user ID
  reviewedAt?: string;              // Review timestamp
  reviewNotes?: string;             // Site owner's notes/reason
  
  // Metadata
  submittedAt: string;
  expiresAt: string;                // 30 days from submission
}

interface EvidenceFile {
  id: string;
  filename: string;
  contentType: string;              // 'image/jpeg', 'image/png', 'application/pdf'
  size: number;                     // bytes
  url: string;                      // Azure Blob Storage URL (secured)
  uploadedAt: string;
}
```

**Rules:**
- ✅ **Regular Members:** Can use any organizational email or personal email
- ✅ **Auto Admin Verification:** .gov.au email addresses
- ✅ **Manual Admin Verification:** Upload membership evidence for site owner approval
- ⚠️ **Brigade Claiming:** .gov.au email OR approved verification request
- ⚠️ **Admin Promotion:** .gov.au email OR approved verification request

**Examples:**
- ✅ `john.smith@rfs.nsw.gov.au` - Auto-verified admin (instant)
- ✅ `sarah.jones@fire.nsw.gov.au` - Auto-verified admin (instant)
- ✅ `volunteer@griffithrfs.org.au` + uploaded ID card → Pending site owner review → Approved → Can become admin
- ✅ `volunteer@gmail.com` + uploaded membership certificate → Pending review → Approved → Can become admin
- ❌ `volunteer@gmail.com` - Cannot become admin without verification

### Updated Admin Eligibility Check

```typescript
function canBecomeAdmin(user: User): { eligible: boolean; method?: string; reason?: string } {
  // Method 1: Check for .gov.au email (auto-verify)
  if (isGovernmentEmail(user.email)) {
    return { 
      eligible: true, 
      method: 'auto-verified',
      reason: 'Government email address' 
    };
  }
  
  // Method 2: Check for approved verification request
  const verification = getApprovedVerificationForUser(user.id);
  if (verification && verification.status === 'approved') {
    return { 
      eligible: true, 
      method: 'manually-verified',
      reason: 'Site owner approved membership evidence' 
    };
  }
  
  // No verification
  return { 
    eligible: false, 
    reason: 'Requires .gov.au email or approved verification request' 
  };
}
```

### Domain Whitelisting

Brigades can configure allowed domains for auto-approval:

```typescript
interface BrigadeEmailConfig {
  allowedDomains: string[];      // ['@griffithrfs.org.au', '@rfs.nsw.gov.au']
  allowedEmails: string[];       // ['specific@email.com']
  requireManualApproval: boolean; // true = admin must approve all, false = auto-approve whitelisted
}
```

**Auto-Approval Logic:**
1. Check if user email matches `allowedEmails` → Auto-approve
2. Check if user email domain matches `allowedDomains` → Auto-approve
3. If `requireManualApproval = false` AND matched → Auto-approve
4. Otherwise → Require admin approval

---

## 2. Brigade Claiming Process

### Unclaimed Brigade State

**Initial Setup:**
- Brigades pre-seeded from RFS dataset with `isClaimed: false`
- No members initially
- Public can view historical routes (if any)
- Cannot create new routes until claimed

### Claiming Eligibility

**Requirements (Two Pathways):**

**Pathway 1: Auto-Verified (.gov.au email)**
- ✅ User must have `.gov.au` email address
- ✅ Brigade must be unclaimed (`isClaimed: false`)
- ✅ User must not already be a member of this brigade
- ✅ Instant claiming (no waiting period)

**Pathway 2: Manual Verification (Non-.gov.au email)**
- ✅ User must have approved AdminVerificationRequest
- ✅ Brigade must be unclaimed (`isClaimed: false`)
- ✅ User must not already be a member of this brigade
- ⏳ Requires site owner approval before claiming (1-3 business days typical)

### Claiming Workflow

**For Auto-Verified Users (.gov.au email):**
```
1. User searches for their brigade (by name, location, or RFS station)
2. System displays unclaimed brigades matching search
3. User selects brigade and clicks "Claim Brigade"
4. System validates:
   - User email ends with .gov.au ✅
   - Brigade is unclaimed ✅
   - User not already member ✅
5. System executes immediately:
   - Set brigade.isClaimed = true
   - Set brigade.claimedAt = <current timestamp>
   - Set brigade.claimedBy = <user.id>
   - Add user.id to brigade.adminUserIds[]
   - Create BrigadeMembership: { role: 'admin', status: 'active' }
6. User redirected to brigade dashboard as first admin
```

**For Users Requiring Manual Verification:**
```
1. User searches for their brigade
2. System displays unclaimed brigades
3. User selects brigade and clicks "Claim Brigade"
4. System detects non-.gov.au email and shows verification required
5. User clicks "Request Verification"
6. System shows verification upload form:
   - Brigade selection (pre-filled)
   - Upload evidence files (max 5 files, 10MB total)
   - Explanation text area (why you should be admin)
   - Submit button
7. User uploads evidence:
   - ID card photo
   - Membership certificate
   - Official letter from captain
   - Training certificates
   - Other proof documents
8. User submits verification request
9. System creates AdminVerificationRequest with status: 'pending'
10. Email sent to site owner with review link
11. User sees confirmation: "Verification submitted. You'll be notified when reviewed (typically 1-3 business days)"
12. Site owner reviews request:
    - Views uploaded evidence
    - Checks brigade details
    - Approves or rejects with notes
13. If approved:
    - Update AdminVerificationRequest.status = 'approved'
    - Email user: "Verification approved! You can now claim the brigade."
    - User returns to brigade claiming page
    - System allows brigade claiming (now that verification is approved)
    - User completes claiming process (same as step 5 above)
14. If rejected:
    - Update AdminVerificationRequest.status = 'rejected'
    - Email user with rejection reason
    - User can resubmit with additional evidence
```

**Post-Claiming:**
- First admin can invite members
- First admin can promote ONE additional member to admin (max 2 total)
- Brigade can customize settings (logo, theme, contact info)

---

## 2a. Site Owner (Super Admin) Verification Management

### Site Owner Role

**Purpose:**
The site owner (super admin) is responsible for:
- Reviewing and approving admin verification requests
- Ensuring only legitimate brigade members become admins
- Maintaining system integrity and security
- Managing site-wide settings

**Access:**
- Special "Site Owner" role separate from brigade admin
- Access to all brigades (read-only for oversight)
- Access to verification queue and tools
- Audit log of all verification decisions

### Verification Request Review Workflow

**Site Owner Review Interface:**
```
/admin/verification-requests

Shows list of pending verification requests:
- User name and email
- Brigade name and location
- Submission date
- Number of evidence files uploaded
- User's explanation
- Quick action buttons (Approve/Reject/View Details)
```

**Detailed Review Page:**
```
/admin/verification-requests/:requestId

Displays:
1. User Information
   - Name: John Volunteer
   - Email: john.volunteer@gmail.com
   - Registration date: Dec 1, 2024
   - Current memberships: None

2. Brigade Information
   - Name: Griffith Rural Fire Service
   - Location: Griffith, NSW
   - RFS Station ID: #12345
   - Currently claimed: No
   - Existing admins: None

3. Evidence Files (Downloadable/Viewable)
   - volunteer_id_card.jpg (2.3 MB) [View]
   - membership_certificate.pdf (1.1 MB) [View]
   - captain_letter.jpg (0.8 MB) [View]

4. User's Explanation
   "I am a volunteer firefighter with Griffith RFS since 2018. I serve 
   as deputy captain and manage our social media. Our state doesn't 
   provide .gov.au emails to volunteers. I've attached my official ID 
   card, membership certificate, and a letter from our captain confirming 
   my role."

5. Site Owner Actions
   [Approve] [Reject] [Request More Info]
   
   Review Notes (private, for audit):
   [Text area for site owner's notes]

6. Verification Checklist
   [ ] ID or badge appears authentic
   [ ] Documents match user's name
   [ ] Brigade name matches RFS dataset
   [ ] User's explanation is reasonable
   [ ] No red flags or concerns
```

**Approval Process:**
```typescript
async function approveVerificationRequest(
  requestId: string,
  siteOwnerId: string,
  reviewNotes: string
): Promise<Result> {
  const request = await getVerificationRequest(requestId);
  
  // Update request
  request.status = 'approved';
  request.reviewedBy = siteOwnerId;
  request.reviewedAt = new Date().toISOString();
  request.reviewNotes = reviewNotes;
  
  await saveVerificationRequest(request);
  
  // Mark user as verified for this brigade
  const user = await getUser(request.userId);
  if (!user.verifiedBrigades) {
    user.verifiedBrigades = [];
  }
  user.verifiedBrigades.push(request.brigadeId);
  await saveUser(user);
  
  // Send approval email to user
  await sendEmail({
    to: user.email,
    subject: 'Admin Verification Approved',
    body: `Your request to become admin of ${brigade.name} has been approved. 
           You can now claim the brigade at: ${appUrl}/brigades/claim`
  });
  
  // Log action
  await createAuditLog({
    eventType: 'verification.approved',
    actorId: siteOwnerId,
    targetId: request.userId,
    brigadeId: request.brigadeId,
    metadata: { requestId, reviewNotes }
  });
  
  return { success: true };
}
```

**Rejection Process:**
```typescript
async function rejectVerificationRequest(
  requestId: string,
  siteOwnerId: string,
  rejectionReason: string
): Promise<Result> {
  const request = await getVerificationRequest(requestId);
  
  // Update request
  request.status = 'rejected';
  request.reviewedBy = siteOwnerId;
  request.reviewedAt = new Date().toISOString();
  request.reviewNotes = rejectionReason;
  
  await saveVerificationRequest(request);
  
  // Send rejection email with reason
  const user = await getUser(request.userId);
  await sendEmail({
    to: user.email,
    subject: 'Admin Verification - Additional Information Needed',
    body: `Your verification request for ${brigade.name} requires additional 
           information or clarification:
           
           ${rejectionReason}
           
           You can submit a new request with additional evidence at:
           ${appUrl}/verification/resubmit/${requestId}`
  });
  
  // Log action
  await createAuditLog({
    eventType: 'verification.rejected',
    actorId: siteOwnerId,
    targetId: request.userId,
    brigadeId: request.brigadeId,
    metadata: { requestId, rejectionReason }
  });
  
  return { success: true };
}
```

### Verification Request Constraints

```typescript
interface VerificationConstraints {
  // File uploads
  maxFiles: 5;                      // Maximum files per request
  maxTotalSize: 10 * 1024 * 1024;   // 10 MB total
  maxFileSize: 5 * 1024 * 1024;     // 5 MB per file
  allowedTypes: ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'];
  
  // Request limits
  maxActiveRequestsPerUser: 3;      // Can't have more than 3 pending at once
  resubmitCooldown: 24;             // Hours before can resubmit rejected request
  expirationDays: 30;               // Auto-expire after 30 days if not reviewed
  
  // Text fields
  explanationMinLength: 50;         // Minimum characters
  explanationMaxLength: 500;        // Maximum characters
  reviewNotesMaxLength: 1000;       // Site owner notes
}
```

### Verification Evidence Storage

**Azure Blob Storage:**
- Evidence files stored securely in Azure Blob Storage
- Container: `verification-evidence`
- Path structure: `{requestId}/{filename}`
- Access: Private (requires authentication)
- Retention: 90 days after approval/rejection

**Security:**
- Files scanned for malware on upload
- Only site owner can view evidence files
- URLs expire after 1 hour (SAS tokens)
- Files deleted after 90 days for privacy

---

## 3. Admin Management Rules

### Admin Count Constraints

**Hard Requirements:**
- ✅ **Minimum:** 1 admin (enforced at all times)
- ✅ **Maximum:** 2 admins (hard limit)
- ❌ **Never:** 0 admins or 3+ admins

### Admin Promotion

**Eligibility:**
```typescript
function canPromoteToAdmin(user: User, brigade: Brigade): Result {
  // Check verification status (Method 1: .gov.au OR Method 2: Approved verification)
  const verificationCheck = canBecomeAdmin(user);
  if (!verificationCheck.eligible) {
    return { 
      error: 'User requires .gov.au email OR approved admin verification',
      action: 'requestVerification'
    };
  }
  
  // Brigade must have less than 2 admins
  if (brigade.adminUserIds.length >= 2) {
    return { error: 'Brigade already has maximum 2 admins' };
  }
  
  // User must be active member
  const membership = getMembership(brigade.id, user.id);
  if (membership.status !== 'active') {
    return { error: 'User must be active member' };
  }
  
  // User must not already be admin
  if (membership.role === 'admin') {
    return { error: 'User is already an admin' };
  }
  
  return { 
    success: true,
    verificationType: verificationCheck.method // 'auto-verified' or 'manually-verified'
  };
}
```

**Promotion Process:**
1. Admin views member list and clicks "Promote to Admin" on eligible member
2. System checks eligibility:
   - If .gov.au email: Instant promotion allowed
   - If non-.gov.au email: Check for approved verification
     - If approved: Proceed with promotion
     - If not approved: Show "Request Verification" button
3. If eligible, admin confirms promotion
4. System executes:
   - Add `user.id` to `brigade.adminUserIds[]`
   - Update `membership.role = 'admin'`
   - Send notification to promoted user
   - Log action in audit trail with verification type
5. UI updates to show new admin badge

**Promotion from Non-.gov.au Email:**
```
Example: Promoting user volunteer@gmail.com to admin

1. Admin clicks "Promote to Admin" on volunteer@gmail.com
2. System detects non-.gov.au email
3. System checks for approved verification for this user + brigade
4. If NO approved verification:
   - Show message: "This user requires admin verification first"
   - Show "Help User Request Verification" button
   - Clicking sends email to user with verification request link
   - Promotion paused until verification approved
5. If approved verification exists:
   - Show: "User verified by site owner on [date]"
   - Allow promotion to proceed normally
   - Include verification info in audit log
```
1. Admin clicks "Promote to Admin" on eligible member
2. System validates eligibility (see above)
3. If valid:
   - Add `user.id` to `brigade.adminUserIds[]`
   - Update `membership.role = 'admin'`
   - Send notification to promoted user
   - Log action in audit trail
4. UI updates to show new admin badge

### Admin Demotion

**Constraints:**
```typescript
function canDemoteFromAdmin(userId: string, brigade: Brigade): Result {
  // Cannot demote if only 1 admin (would leave brigade with no admins)
  if (brigade.adminUserIds.length <= 1) {
    return { error: 'Cannot demote last admin. Brigade must have at least 1 admin.' };
  }
  
  return { success: true };
}
```

**Demotion Process:**
1. Admin clicks "Demote from Admin" on another admin
2. System validates constraints (see above)
3. If valid:
   - Remove `user.id` from `brigade.adminUserIds[]`
   - Update `membership.role = 'operator'` (default demotion role)
   - Send notification to demoted user
   - Log action in audit trail
4. UI updates to show operator badge

**Special Cases:**
- ❌ Admin cannot demote themselves if they're the last admin
- ✅ Admin can demote themselves if another admin exists
- ✅ Demoted admins become operators (not viewers)

---

## 4. Member Invitation System

### Who Can Invite

**Invitation Privileges:**
- ✅ **Admins:** Can invite members with any role (admin requires .gov.au)
- ✅ **Operators:** Can invite operators and viewers (not admins)
- ✅ **Viewers:** Can invite viewers only
- ❌ **Non-members:** Cannot invite

### Invitation Workflow

```
1. Member opens "Invite Member" dialog
2. Member enters:
   - Email address (required)
   - Proposed role: operator or viewer (admins promoted separately)
   - Optional personal message
3. System validates:
   - Inviter has permission to invite this role ✅
   - Email is valid format ✅
   - Email not already member ✅
   - No pending invitation exists for this email ✅
   - Brigade has < 10 pending invitations ✅
4. System creates MemberInvitation:
   - Generates unique token
   - Sets expiration (7 days default)
   - Status: 'pending'
5. Email sent to invitee with invitation link:
   https://app.com/invitations/{token}
6. Invitee receives email and clicks link
```

### Invitation Acceptance

```
7. Invitee lands on invitation page
8. If not registered:
   - Redirect to registration flow
   - After registration, redirect back to invitation
9. If registered:
   - Show invitation details (brigade, role, inviter, message)
   - Show "Accept" and "Decline" buttons
10. If accepted:
    - Check brigade.requireManualApproval
    - If false OR email matches whitelist:
      → Create membership with status: 'active'
      → Send welcome notification
      → Redirect to brigade dashboard
    - If true AND email NOT whitelisted:
      → Create membership with status: 'pending'
      → Notify admins of pending approval
      → Show "Awaiting approval" message
11. If declined:
    - Update invitation.status = 'declined'
    - Notify inviter
    - Show confirmation message
```

### Invitation Constraints

```typescript
interface InvitationConstraints {
  maxPendingPerBrigade: 10;        // Max pending invitations per brigade
  validityDays: 7;                 // Days until invitation expires
  allowDuplicates: false;          // Can't invite same email twice
  allowExistingMembers: false;     // Can't invite current members
  resendCooldownHours: 24;         // Hours before can resend cancelled invitation
}
```

---

## 5. Member Approval Workflow

### Manual Approval (requireManualApproval = true)

**When Required:**
- Brigade has `requireManualApproval: true` in settings
- User email does NOT match `allowedDomains` or `allowedEmails`

**Approval Process:**
```
1. New member joins (via invitation or self-signup)
2. System creates BrigadeMembership with status: 'pending'
3. All brigade admins receive notification:
   - New member name and email
   - Link to pending approvals page
4. Admin navigates to pending approvals
5. Admin reviews member details:
   - Email address
   - Requested role
   - Who invited them (if applicable)
   - Date requested
6. Admin chooses action:
   
   APPROVE:
   - Update membership.status = 'active'
   - Set membership.approvedBy = <admin user ID>
   - Set membership.approvedAt = <timestamp>
   - Set membership.joinedAt = <timestamp>
   - Send approval email to new member
   - Log approval action
   
   REJECT:
   - Delete membership record
   - Send rejection email to user (with optional reason)
   - Log rejection action
   - Optional: Add email to brigade blacklist
```

### Auto-Approval (requireManualApproval = false)

**When Triggered:**
- Brigade has `requireManualApproval: false` in settings
- User email matches `allowedDomains` OR `allowedEmails`

**Auto-Approval Process:**
```
1. New member joins (via invitation)
2. System checks email against whitelist
3. If match found:
   - Create BrigadeMembership with status: 'active'
   - Set membership.joinedAt = <timestamp>
   - No approval needed
   - Send welcome email
   - Redirect to brigade dashboard immediately
4. If no match:
   - Fall back to manual approval process (even if requireManualApproval = false)
```

---

## 6. Member Removal

### Who Can Remove

**Removal Privileges:**
- ✅ **Admins:** Can remove any member (except themselves if last admin)
- ❌ **Operators:** Cannot remove members
- ❌ **Viewers:** Cannot remove members

### Removal Constraints

```typescript
function canRemoveMember(targetUserId: string, removerId: string, brigade: Brigade): Result {
  const remover = getMembership(brigade.id, removerId);
  const target = getMembership(brigade.id, targetUserId);
  
  // Only admins can remove members
  if (remover.role !== 'admin') {
    return { error: 'Only admins can remove members' };
  }
  
  // If removing an admin, ensure brigade will still have at least 1 admin
  if (target.role === 'admin') {
    if (brigade.adminUserIds.length <= 1) {
      return { error: 'Cannot remove last admin' };
    }
  }
  
  // Admin cannot remove themselves if they're the last admin
  if (targetUserId === removerId && target.role === 'admin' && brigade.adminUserIds.length === 1) {
    return { error: 'Cannot remove yourself as last admin. Promote another member first.' };
  }
  
  return { success: true };
}
```

### Removal Workflow

```
1. Admin clicks "Remove Member" on member's profile
2. System shows confirmation modal:
   - "Remove [Member Name] from [Brigade Name]?"
   - Optional reason field (for audit trail)
   - Confirm / Cancel buttons
3. If confirmed:
   - Validate constraints (see above)
   - If removing admin: Remove from brigade.adminUserIds[]
   - Update membership.status = 'removed'
   - Set membership.removedBy = <admin user ID>
   - Set membership.removedAt = <timestamp>
   - Send removal notification to removed member
   - Log removal action with reason
4. UI updates to remove member from list
```

**Important Notes:**
- Removing a member does NOT delete their User account
- Removed member can join other brigades
- Removed member can be re-invited to same brigade later
- Member's created routes remain with brigade (routes owned by brigade, not individuals)

---

## 7. Self-Service Leave Brigade

### Leave Eligibility

```typescript
function canLeaveBrigade(userId: string, brigadeId: string): Result {
  const membership = getMembership(brigadeId, userId);
  const brigade = getBrigade(brigadeId);
  
  // Must be active member
  if (membership.status !== 'active') {
    return { error: 'Membership is not active' };
  }
  
  // If admin, ensure brigade will still have at least 1 admin
  if (membership.role === 'admin' && brigade.adminUserIds.length <= 1) {
    return {
      error: 'You are the last admin. Promote another member to admin before leaving.',
      requiresAdminTransfer: true
    };
  }
  
  return { success: true };
}
```

### Leave Workflow

```
1. Member navigates to their profile or brigade settings
2. Member clicks "Leave Brigade" button
3. System validates eligibility (see above)
4. If ineligible (last admin):
   - Show error: "You must promote another member to admin before leaving"
   - Provide link to member management
   - Suggest eligible members with .gov.au emails
5. If eligible:
   - Show confirmation modal:
     "Are you sure you want to leave [Brigade Name]? You will lose access to all routes and settings."
   - Confirm / Cancel buttons
6. If confirmed:
   - If member is admin: Remove from brigade.adminUserIds[]
   - Update membership.status = 'removed'
   - Set membership.removedBy = <user ID> (self-removed)
   - Set membership.removedAt = <timestamp>
   - Send confirmation email
   - Log action
   - Redirect to user's brigade list or home page
```

**Admin Transfer Workflow (Before Leaving):**
```
If user is last admin and wants to leave:
1. Show admin transfer screen
2. List eligible members (active members with .gov.au emails)
3. User selects member to promote
4. System promotes selected member to admin
5. User can now leave brigade
```

---

## 8. Multi-Brigade Membership

### Membership Model

**Data Structure:**
```typescript
// User can have multiple memberships
interface UserContext {
  user: User;                      // Single user account
  memberships: BrigadeMembership[]; // Array of memberships (one per brigade)
  currentBrigadeId?: string;       // Currently active brigade (UI context)
}

// Example: User in 3 brigades with different roles
{
  user: { id: 'user-1', email: 'john@rfs.nsw.gov.au' },
  memberships: [
    { brigadeId: 'griffith', role: 'admin', status: 'active' },
    { brigadeId: 'wagga', role: 'operator', status: 'active' },
    { brigadeId: 'albury', role: 'viewer', status: 'active' }
  ],
  currentBrigadeId: 'griffith'  // Currently viewing Griffith brigade
}
```

### Independent Role Management

**Rules:**
- ✅ Each brigade membership has its own role (admin, operator, viewer)
- ✅ Role in Brigade A does NOT affect role in Brigade B
- ✅ User can be admin in one brigade, viewer in another
- ✅ Permissions scoped to current brigade context

### Brigade Switching

**UI Flow:**
```
1. User clicks brigade switcher in header (dropdown or menu)
2. System shows list of user's active memberships:
   - Brigade name
   - User's role in that brigade
   - Visual indicator for current brigade
3. User selects different brigade
4. System updates currentBrigadeId in session
5. UI redirects to selected brigade's dashboard
6. All subsequent actions scoped to new brigade
```

**Context Management:**
```typescript
// Routes scoped to current brigade
GET /dashboard → Shows current brigade's routes
POST /dashboard/routes/new → Creates route for current brigade

// Settings scoped to current brigade
GET /dashboard/settings → Shows current brigade's settings
PATCH /dashboard/settings → Updates current brigade only

// Members scoped to current brigade
GET /dashboard/members → Shows current brigade's members
POST /dashboard/members/invite → Invites to current brigade
```

---

## 9. Role-Based Access Control (RBAC)

### Role Definitions

#### Admin Role

**Full Access:**
- ✅ View, create, edit, delete all routes
- ✅ Publish and unpublish routes
- ✅ Navigate routes with turn-by-turn directions
- ✅ Broadcast location during Santa runs
- ✅ Invite members (any role, admin requires .gov.au)
- ✅ Approve/reject pending memberships
- ✅ Promote members to admin (if .gov.au and < 2 admins)
- ✅ Demote admins to operator (if > 1 admin)
- ✅ Remove members (except last admin)
- ✅ Edit brigade settings (logo, theme, contact, domains)
- ✅ Claim unclaimed brigades (if .gov.au email)
- ✅ View analytics and statistics

#### Operator Role

**Route Management:**
- ✅ View all brigade routes
- ✅ Create new routes
- ✅ Edit all routes
- ✅ Delete routes (with confirmation)
- ✅ Publish routes
- ✅ Navigate routes with turn-by-turn directions
- ✅ Broadcast location during Santa runs

**Limited Member Management:**
- ✅ Invite new members (operator or viewer roles only)
- ❌ Cannot invite admins
- ❌ Cannot approve memberships
- ❌ Cannot remove members
- ❌ Cannot promote/demote roles

**No Settings Access:**
- ❌ Cannot edit brigade settings
- ❌ Cannot claim brigades

#### Viewer Role

**View Only:**
- ✅ View all brigade routes
- ✅ View public tracking pages
- ✅ Invite new viewers only

**No Creation/Editing:**
- ❌ Cannot create routes
- ❌ Cannot edit routes
- ❌ Cannot delete routes
- ❌ Cannot publish routes
- ❌ Cannot navigate or broadcast

**No Management:**
- ❌ Cannot manage members (except invite viewers)
- ❌ Cannot edit brigade settings

### Permission Matrix

| Action | Admin | Operator | Viewer | Public |
|--------|-------|----------|--------|--------|
| **Routes** |
| View routes | ✅ | ✅ | ✅ | ❌ |
| Create routes | ✅ | ✅ | ❌ | ❌ |
| Edit routes | ✅ | ✅ | ❌ | ❌ |
| Delete routes | ✅ | ✅ | ❌ | ❌ |
| Publish routes | ✅ | ✅ | ❌ | ❌ |
| Unpublish routes | ✅ | ✅ | ❌ | ❌ |
| Navigate routes | ✅ | ✅ | ❌ | ❌ |
| Broadcast location | ✅ | ✅ | ❌ | ❌ |
| **Tracking** |
| View tracking page | ✅ | ✅ | ✅ | ✅ |
| **Members** |
| View members list | ✅ | ✅ | ✅ | ❌ |
| Invite operator | ✅ | ✅ | ❌ | ❌ |
| Invite viewer | ✅ | ✅ | ✅ | ❌ |
| Invite admin | ✅ | ❌ | ❌ | ❌ |
| Approve members | ✅ | ❌ | ❌ | ❌ |
| Remove members | ✅ | ❌ | ❌ | ❌ |
| Promote to admin | ✅ | ❌ | ❌ | ❌ |
| Demote from admin | ✅ | ❌ | ❌ | ❌ |
| Leave brigade | ✅* | ✅ | ✅ | ❌ |
| **Settings** |
| View settings | ✅ | ✅ | ✅ | ❌ |
| Edit settings | ✅ | ❌ | ❌ | ❌ |
| Edit brigade info | ✅ | ❌ | ❌ | ❌ |
| Manage domains | ✅ | ❌ | ❌ | ❌ |
| **Brigades** |
| Claim brigade | ✅** | ❌ | ❌ | ❌ |
| View analytics | ✅ | ❌ | ❌ | ❌ |

\* Admin can leave only if not last admin  
\** Claim brigade requires .gov.au email

### Permission Checking Utilities

```typescript
// src/utils/permissions.ts

export function canManageRoutes(membership: BrigadeMembership): boolean {
  return ['admin', 'operator'].includes(membership.role) && membership.status === 'active';
}

export function canNavigateRoutes(membership: BrigadeMembership): boolean {
  return ['admin', 'operator'].includes(membership.role) && membership.status === 'active';
}

export function canInviteMembers(membership: BrigadeMembership, targetRole: Role): boolean {
  if (membership.status !== 'active') return false;
  
  if (membership.role === 'admin') return true; // Can invite anyone
  if (membership.role === 'operator' && targetRole !== 'admin') return true;
  if (membership.role === 'viewer' && targetRole === 'viewer') return true;
  
  return false;
}

export function canManageMembers(membership: BrigadeMembership): boolean {
  return membership.role === 'admin' && membership.status === 'active';
}

export function canEditBrigadeSettings(membership: BrigadeMembership): boolean {
  return membership.role === 'admin' && membership.status === 'active';
}

export function canPromoteToAdmin(
  promoterMembership: BrigadeMembership,
  targetUser: User,
  brigade: Brigade
): { allowed: boolean; reason?: string } {
  if (promoterMembership.role !== 'admin' || promoterMembership.status !== 'active') {
    return { allowed: false, reason: 'Only active admins can promote members' };
  }
  
  if (!isGovernmentEmail(targetUser.email)) {
    return { allowed: false, reason: 'Admin must have .gov.au email address' };
  }
  
  if (brigade.adminUserIds.length >= 2) {
    return { allowed: false, reason: 'Brigade already has maximum 2 admins' };
  }
  
  return { allowed: true };
}
```

---

## 10. Data Validation Rules

### User Data

```typescript
interface UserValidation {
  email: {
    format: 'RFC 5322 compliant';
    maxLength: 254;
    unique: true; // Must be unique across all users
  };
  name: {
    minLength: 2;
    maxLength: 100;
    required: true;
  };
  profilePicture: {
    maxSize: '5MB';
    formats: ['image/jpeg', 'image/png', 'image/webp'];
    optional: true;
  };
}
```

### Brigade Data

```typescript
interface BrigadeValidation {
  slug: {
    format: 'lowercase, alphanumeric, hyphens only';
    minLength: 3;
    maxLength: 50;
    unique: true; // Must be unique across all brigades
  };
  name: {
    minLength: 3;
    maxLength: 100;
    required: true;
  };
  location: {
    minLength: 3;
    maxLength: 100;
    required: true;
  };
  adminUserIds: {
    minCount: 1;  // Always enforced
    maxCount: 2;  // Hard limit
    itemType: 'UUID string';
  };
  allowedDomains: {
    format: '@domain.com format';
    maxCount: 10;
  };
  allowedEmails: {
    format: 'Valid email address';
    maxCount: 50;
  };
  logo: {
    maxSize: '2MB';
    formats: ['image/png', 'image/svg+xml'];
    optional: true;
  };
  themeColor: {
    format: 'Hex color (#RRGGBB)';
    optional: true;
  };
}
```

### Membership Data

```typescript
interface MembershipValidation {
  role: {
    allowedValues: ['admin', 'operator', 'viewer'];
    required: true;
  };
  status: {
    allowedValues: ['pending', 'active', 'suspended', 'removed'];
    required: true;
  };
  uniqueConstraint: {
    // One membership per (brigadeId, userId) pair
    unique: ['brigadeId', 'userId'];
  };
}
```

### Invitation Data

```typescript
interface InvitationValidation {
  email: {
    format: 'Valid email address';
    required: true;
  };
  role: {
    allowedValues: ['operator', 'viewer']; // Admin not invited, promoted
    required: true;
  };
  status: {
    allowedValues: ['pending', 'accepted', 'declined', 'expired', 'cancelled'];
    required: true;
  };
  token: {
    format: 'UUID v4';
    unique: true;
    required: true;
  };
  expiresAt: {
    minValue: 'now + 1 day';
    maxValue: 'now + 30 days';
    default: 'now + 7 days';
  };
  personalMessage: {
    maxLength: 500;
    optional: true;
  };
}
```

---

## 11. Error Handling & Messages

### User-Friendly Error Messages

```typescript
export const ErrorMessages = {
  // Authentication
  INVALID_EMAIL: 'Please enter a valid email address',
  EMAIL_ALREADY_EXISTS: 'This email is already registered',
  GOVERNMENT_EMAIL_REQUIRED: 'Admin role requires a .gov.au email address',
  
  // Brigade Claiming
  BRIGADE_ALREADY_CLAIMED: 'This brigade has already been claimed',
  MUST_BE_GOVERNMENT_EMAIL: 'Only government employees (.gov.au) can claim brigades',
  ALREADY_MEMBER: 'You are already a member of this brigade',
  
  // Admin Management
  MAX_ADMINS_REACHED: 'This brigade already has the maximum of 2 admins',
  LAST_ADMIN_CANNOT_LEAVE: 'You are the last admin. Promote another member before leaving.',
  LAST_ADMIN_CANNOT_BE_REMOVED: 'Cannot remove the last admin. Promote someone else first.',
  CANNOT_DEMOTE_LAST_ADMIN: 'Cannot demote the last admin. Promote another member first.',
  
  // Invitations
  ALREADY_INVITED: 'This email has already been invited',
  ALREADY_MEMBER_INVITE: 'This person is already a member',
  INVALID_INVITATION_TOKEN: 'This invitation link is invalid',
  INVITATION_EXPIRED: 'This invitation has expired',
  MAX_PENDING_INVITATIONS: 'You have reached the maximum of 10 pending invitations',
  
  // Permissions
  PERMISSION_DENIED: 'You do not have permission to perform this action',
  ADMIN_ONLY: 'Only admins can perform this action',
  MUST_BE_ACTIVE_MEMBER: 'You must be an active member to perform this action',
  
  // Validation
  INVALID_ROLE: 'Invalid role specified',
  INVALID_STATUS: 'Invalid status specified',
  REQUIRED_FIELD: 'This field is required',
};
```

---

## 12. Audit Logging Requirements

### Events to Log

```typescript
type AuditEventType =
  // Authentication
  | 'user.registered'
  | 'user.login'
  | 'user.logout'
  | 'user.login_failed'
  
  // Brigade Management
  | 'brigade.claimed'
  | 'brigade.settings_updated'
  
  // Membership
  | 'member.invited'
  | 'member.invitation_accepted'
  | 'member.invitation_declined'
  | 'member.approved'
  | 'member.rejected'
  | 'member.removed'
  | 'member.left'
  
  // Role Changes
  | 'member.promoted_to_admin'
  | 'member.demoted_from_admin'
  | 'member.role_changed'
  
  // Route Management
  | 'route.created'
  | 'route.published'
  | 'route.deleted';

interface AuditLog {
  id: string;
  eventType: AuditEventType;
  timestamp: string;
  actorId: string;          // User who performed action
  targetId?: string;        // User/resource affected
  brigadeId?: string;       // Brigade context
  metadata: Record<string, any>; // Event-specific details
  ipAddress?: string;       // For security
  userAgent?: string;       // For debugging
}
```

### Audit Log Retention

- **Authentication events:** 90 days
- **Membership changes:** 365 days (1 year)
- **Admin actions:** 730 days (2 years)
- **Route actions:** 180 days (6 months)

---

## 13. Implementation Checklist

### Phase 6a: Data Schema Updates

- [ ] Create User interface (`src/types/user.ts`)
- [ ] Update Brigade interface with admin fields
- [ ] Create BrigadeMembership interface (`src/types/membership.ts`)
- [ ] Create MemberInvitation interface (`src/types/invitation.ts`)
- [ ] Update Route interface (createdBy → user ID)
- [ ] Update storage adapter interfaces
- [ ] Implement localStorage operations for new entities
- [ ] Implement Azure Table Storage operations
- [ ] Create business logic utilities (`src/utils/membershipRules.ts`)
- [ ] Create email validation utilities (`src/utils/emailValidation.ts`)
- [ ] Create membership service (`src/services/membershipService.ts`)
- [ ] Create API endpoints for users
- [ ] Create API endpoints for memberships
- [ ] Create API endpoints for invitations
- [ ] Write unit tests for validation rules
- [ ] Write integration tests for membership operations
- [ ] Document API endpoints
- [ ] Create migration scripts

### Phase 7: Authentication Implementation

- [ ] Set up Entra External ID tenant
- [ ] Configure application registration
- [ ] Install and configure MSAL
- [ ] Update AuthContext to use MSAL
- [ ] Create login/logout pages
- [ ] Update ProtectedRoute component
- [ ] Create brigade claiming UI
- [ ] Create member invitation UI
- [ ] Create member approval UI
- [ ] Create admin management UI
- [ ] Create member removal UI
- [ ] Implement permission checking throughout app
- [ ] Secure API endpoints with JWT validation
- [ ] Implement audit logging
- [ ] Test all authentication flows
- [ ] Test all membership workflows
- [ ] Document authentication setup
- [ ] Deploy to production with auth enabled

---

## Appendix: Quick Reference

### Admin Requirements
- ✅ .gov.au email (mandatory)
- ✅ 1-2 per brigade (enforced)
- ✅ Cannot leave if last admin

### Member Roles
- **Admin:** Full access + member management
- **Operator:** Route management + limited invites
- **Viewer:** Read-only + invite viewers

### Key Constraints
- Min 1 admin per brigade (always)
- Max 2 admins per brigade (hard limit)
- Max 10 pending invitations per brigade
- Invitations expire after 7 days

### Email Requirements
- Admins: .gov.au only
- Members: Any organizational or .gov.au
- Claiming: .gov.au only

### Status Values
- **Brigade:** claimed, unclaimed
- **Membership:** pending, active, suspended, removed
- **Invitation:** pending, accepted, declined, expired, cancelled

---

**Document Maintained By:** Development Team  
**Next Review:** After Phase 6a Implementation  
**Questions/Issues:** Create GitHub issue with label `auth-planning`
