# Fire Santa Run - Authentication Planning Summary

**Status:** Planning Complete - Ready for Implementation  
**Date:** December 2024  
**Related Documents:**
- MASTER_PLAN.md (Section 12, 12a, Phase 6a, Phase 7)
- docs/AUTHENTICATION_BUSINESS_RULES.md (Complete reference)

---

## Executive Summary

This document provides a quick reference summary of the comprehensive authentication planning completed for the Fire Santa Run application. The authentication system supports two pathways for brigade admins to accommodate states that do and don't issue government email addresses to volunteers.

---

## Key Innovation: Dual Admin Verification Pathways

### Problem Statement
Some Australian states/organizations issue .gov.au email addresses to volunteer brigade members, while others do not. We need a flexible system that maintains security while accommodating both scenarios.

### Solution: Two-Pathway Verification

#### Pathway 1: Automatic Verification
- **Who:** Users with `.gov.au` email addresses
- **Process:** Instant verification (no waiting)
- **Use Case:** States/organizations that issue government emails
- **Example:** `john@rfs.nsw.gov.au` → Immediate admin eligibility

#### Pathway 2: Manual Verification  
- **Who:** Users without `.gov.au` email addresses
- **Process:** Upload evidence → Site owner review → Approval
- **Use Case:** States/organizations without government email for volunteers
- **Example:** `volunteer@gmail.com` + ID photo → Site owner approves → Admin eligibility granted

---

## Data Models Overview

### New Entities

#### AdminVerificationRequest
```typescript
{
  id: string;
  userId: string;
  brigadeId: string;
  evidenceFiles: EvidenceFile[];     // Photos, PDFs of ID, certificates
  explanation: string;               // User's explanation (50-500 chars)
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reviewedBy?: string;               // Site owner ID
  reviewedAt?: string;
  reviewNotes?: string;              // Site owner's notes
  submittedAt: string;
  expiresAt: string;                 // 30 days from submission
}
```

#### EvidenceFile
```typescript
{
  id: string;
  filename: string;
  contentType: string;               // 'image/jpeg', 'image/png', 'application/pdf'
  size: number;                      // bytes
  url: string;                       // Azure Blob Storage URL (secured)
  uploadedAt: string;
}
```

#### SiteOwner
```typescript
{
  id: string;
  userId: string;
  isSuperAdmin: boolean;
  permissions: SiteOwnerPermission[]; // Granular permissions
  createdAt: string;
  createdBy: string;
}
```

### Updated Entities

#### User (Updated)
```typescript
{
  // ... existing fields
  verifiedBrigades?: string[];       // Brigade IDs with approved verification
}
```

---

## Verification Workflow

### For Users (Requesting Verification)

1. **Trigger:** User without .gov.au email attempts to claim brigade or be promoted to admin
2. **UI Shows:** "Verification Required" message with "Request Verification" button
3. **User Submits:**
   - Brigade selection
   - Evidence files (max 5, 10MB total):
     - ID card photo
     - Membership certificate
     - Captain's letter
     - Training certificates
   - Explanation (why they should be admin)
4. **System Response:**
   - Creates AdminVerificationRequest
   - Uploads files to Azure Blob Storage
   - Sends email to site owner
   - Shows confirmation to user
5. **User Waits:** Typical 1-3 business days for review
6. **Outcome:**
   - If approved: Email notification + can now claim brigade/become admin
   - If rejected: Email with reason + can resubmit with more evidence

### For Site Owners (Reviewing Requests)

1. **Access:** Navigate to `/admin/verification-requests`
2. **View Queue:** List of pending verification requests
3. **Review Request:**
   - User name and email
   - Brigade name and location
   - Uploaded evidence files (view/download)
   - User's explanation
   - Verification checklist
4. **Decision:**
   - **Approve:** User marked as verified for this brigade
   - **Reject:** User notified with reason, can resubmit
   - **Request More Info:** Ask for additional evidence
5. **Actions Logged:** All decisions recorded in audit trail

---

## Business Rules Quick Reference

### Admin Eligibility
✅ **Can Become Admin:**
- User with .gov.au email (instant)
- User with approved AdminVerificationRequest for the brigade

❌ **Cannot Become Admin:**
- User without .gov.au email AND no approved verification

### Brigade Claiming
✅ **Can Claim Brigade:**
- Brigade is unclaimed (`isClaimed: false`)
- User has .gov.au email OR approved verification
- User not already a member

### Admin Count
- ✅ Minimum: 1 admin (always enforced)
- ✅ Maximum: 2 admins (hard limit)
- ❌ Never: 0 admins or 3+ admins

### File Upload Constraints
- Max files: 5 per request
- Max size per file: 5 MB
- Max total size: 10 MB
- Allowed types: JPEG, PNG, HEIC, PDF
- Security: Malware scanning on upload

### Request Lifecycle
- Pending: Awaiting site owner review
- Approved: User can become admin for this brigade
- Rejected: User can resubmit after 24 hours
- Expired: Auto-expire after 30 days if not reviewed

---

## Implementation Phases

### Phase 6a: Data Schema Updates (Week 6)
**Focus:** Prepare all data models and business logic

- [ ] Create AdminVerificationRequest, EvidenceFile, SiteOwner types
- [ ] Update User with verifiedBrigades field
- [ ] Extend storage adapters for verification CRUD
- [ ] Implement verification service
- [ ] Create file validation utilities
- [ ] Set up Azure Blob Storage for evidence
- [ ] Create verification API endpoints
- [ ] Create site owner admin API endpoints
- [ ] Write comprehensive tests
- [ ] Update documentation

**Deliverables:**
- All TypeScript interfaces defined
- Storage adapters support verification
- Business logic utilities implemented
- API endpoints created and tested
- Dev mode supports verification testing
- Ready for Phase 7 UI implementation

### Phase 7: Authentication Implementation (Week 7-8)
**Focus:** Build UI and integrate with Entra External ID

- [ ] Set up Entra External ID
- [ ] Implement MSAL authentication
- [ ] Create login/logout UI
- [ ] Build brigade claiming UI (both pathways)
- [ ] Build verification request UI
  - [ ] Evidence upload form
  - [ ] File selection and validation
  - [ ] Progress tracking
- [ ] Build site owner review UI
  - [ ] Verification queue dashboard
  - [ ] Request detail page
  - [ ] Evidence viewer
  - [ ] Approve/reject actions
- [ ] Integrate verification into admin promotion
- [ ] Add email notifications
- [ ] Test both verification pathways end-to-end
- [ ] Deploy to production

**Deliverables:**
- Complete authentication flow
- Verification request and review UI
- Site owner admin dashboard
- Email notification system
- Production deployment with auth enabled

---

## Security & Privacy

### Evidence File Security
- **Storage:** Azure Blob Storage (private container)
- **Access:** Secured with SAS tokens (1-hour expiration)
- **Visibility:** Only site owner can view
- **Scanning:** Malware scan on upload
- **Retention:** Auto-delete after 90 days

### Audit Logging
All verification actions logged:
- User submission
- Site owner approval/rejection
- File access (who viewed evidence)
- Verification usage (when admin status granted)

### Privacy Compliance
- Evidence files deleted after 90 days
- Users notified of data retention policy
- Can request evidence deletion
- GDPR-compliant data handling

---

## User Experience

### For Volunteers (Clear Communication)
```
❌ Before:
"You need a .gov.au email to become an admin"

✅ After:
"To become an admin, you need either:
 • A .gov.au email address, OR
 • Upload proof of membership for site owner approval
 
[Request Verification] [Learn More]"
```

### Status Indicators
- 🔄 **Pending:** "Verification under review (typically 1-3 business days)"
- ✅ **Approved:** "Verification approved! You can now claim brigades."
- ❌ **Rejected:** "Additional information needed. [View Details] [Resubmit]"
- ⏰ **Expired:** "Request expired after 30 days. [Submit New Request]"

### Email Notifications
1. **Submission Confirmation:** "Verification request received"
2. **Approval:** "Congratulations! Your verification was approved"
3. **Rejection:** "Additional information needed for verification"
4. **Site Owner Alert:** "New verification request requires review"

---

## Testing Strategy

### Unit Tests
- ✅ Email validation (both pathways)
- ✅ File validation (types, sizes)
- ✅ Verification eligibility checks
- ✅ Admin count enforcement
- ✅ Permission checking

### Integration Tests
- ✅ Verification request submission with file upload
- ✅ Site owner review and approval workflow
- ✅ Brigade claiming with approved verification
- ✅ Admin promotion with approved verification
- ✅ Verification expiration after 30 days

### End-to-End Tests
- ✅ Complete verification journey (user → site owner → approved → claim)
- ✅ Rejection and resubmission flow
- ✅ Multi-brigade verification (same user, different brigades)
- ✅ Evidence file viewing and security
- ✅ Email notification delivery

---

## Success Metrics

### Functionality
- ✅ Both verification pathways work seamlessly
- ✅ Site owner can review requests in <5 minutes
- ✅ Users receive approval within 3 business days (target)
- ✅ No admin eligibility errors or bypasses

### Security
- ✅ All evidence files secured and encrypted
- ✅ Only authorized users can view evidence
- ✅ All verification actions audited
- ✅ No security vulnerabilities in file upload

### User Experience
- ✅ Clear explanation when verification needed
- ✅ Simple evidence upload process
- ✅ Transparent status tracking
- ✅ Timely email notifications

---

## Migration Path

### Existing Brigades (Production)
1. **Current State:** No verification system exists
2. **After Phase 6a:** Data models ready but no UI
3. **After Phase 7:** Full verification system live
4. **Migration:** Existing .gov.au admins unaffected, auto-verified

### Dev Mode Support
- Mock verification requests for testing
- Simulate site owner approvals
- Test both pathways without real evidence upload
- No Azure resources required in dev mode

---

## API Endpoints Summary

### User-Facing Endpoints
- `POST /api/verification/request` - Submit verification request
- `POST /api/verification/upload` - Upload evidence file
- `GET /api/verification/user/:userId` - Get user's requests
- `GET /api/verification/requests/:requestId` - Get request details

### Site Owner Endpoints (Admin Only)
- `GET /api/admin/verification/pending` - List pending requests
- `GET /api/admin/verification/requests/:requestId` - Get full request details
- `POST /api/admin/verification/requests/:requestId/approve` - Approve request
- `POST /api/admin/verification/requests/:requestId/reject` - Reject request
- `GET /api/admin/verification/evidence/:fileId` - Get evidence file (SAS token)

---

## Quick Decision Tree

### Should User Request Verification?

```
Does user have .gov.au email?
├─ YES → No verification needed (instant admin eligibility)
└─ NO → Check verification status
    ├─ Has approved verification for this brigade?
    │   ├─ YES → No verification needed (can become admin)
    │   └─ NO → Request verification required
    └─ Has pending verification?
        ├─ YES → Wait for site owner review
        └─ NO → Submit new verification request
```

---

## Common Questions

### Q: Can a user have multiple verification requests?
**A:** Yes, up to 3 pending requests at once (one per brigade typically).

### Q: How long does verification approval take?
**A:** Target: 1-3 business days. Typical: Same day to 48 hours.

### Q: What happens if verification is rejected?
**A:** User receives email with reason. Can resubmit after 24 hours with additional evidence.

### Q: Can verification approval be revoked?
**A:** Yes, site owner can revoke if evidence was fraudulent. User would need to resubmit.

### Q: What if brigade already has 2 admins?
**A:** Verification can still be approved, but user can only become admin if one admin leaves or is demoted.

### Q: Who can be a site owner?
**A:** System administrators only. Typically the app developer or designated system admin. Requires manual database assignment.

---

## Related Documentation

- **Complete Business Rules:** `docs/AUTHENTICATION_BUSINESS_RULES.md`
- **Data Models:** `MASTER_PLAN.md` Section 12
- **Implementation Plan:** `MASTER_PLAN.md` Phase 6a and Phase 7
- **API Specification:** (To be created in Phase 6a)
- **Site Owner Guide:** (To be created in Phase 7)

---

**Status:** ✅ Planning Complete  
**Next Step:** Begin Phase 6a Implementation  
**Questions:** Create GitHub issue with label `auth-planning`
