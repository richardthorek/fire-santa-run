# API Documentation - Phase 6a Endpoints

This document describes the new API endpoints added in Phase 6a for user management, membership management, invitations, and admin verification.

## Table of Contents
- [Users API](#users-api)
- [Brigade Members API](#brigade-members-api)
- [Brigade Claiming API](#brigade-claiming-api)
- [Invitations API](#invitations-api)
- [Verification API](#verification-api)
- [Admin Verification API](#admin-verification-api)

## Authentication

All endpoints currently use `authLevel: 'anonymous'` for development. In Phase 7, these will be secured with Microsoft Entra External ID authentication.

## Data Models

All API endpoints use the TypeScript interfaces defined in `src/types/`:
- `User` - User accounts (`src/types/user.ts`)
- `BrigadeMembership` - Brigade memberships (`src/types/membership.ts`)
- `MemberInvitation` - Invitation system (`src/types/invitation.ts`)
- `AdminVerificationRequest` - Admin verification (`src/types/verification.ts`)

## Users API

Base path: `/api/users`

### POST /api/users/register
Register a new user account.

**Request Body:**
```json
{
  "id": "string (UUID)",
  "email": "string",
  "name": "string",
  "entraUserId": "string (optional)"
}
```

**Response (201):**
```json
{
  "id": "string",
  "email": "string",
  "name": "string",
  "emailVerified": false,
  "verifiedBrigades": [],
  "createdAt": "ISO 8601 timestamp",
  ...
}
```

**Errors:**
- `400` - Missing required fields
- `409` - User already exists

### GET /api/users/{userId}
Get user profile by ID.

**Response (200):**
```json
{
  "id": "string",
  "email": "string",
  "name": "string",
  "emailVerified": boolean,
  "verifiedBrigades": ["brigadeId1", "brigadeId2"],
  ...
}
```

**Errors:**
- `404` - User not found

### PATCH /api/users/{userId}
Update user profile (name, profile picture, last login).

**Request Body:**
```json
{
  "name": "string (optional)",
  "profilePicture": "string (optional)",
  "lastLoginAt": "ISO 8601 timestamp (optional)"
}
```

**Response (200):** Updated user object

### GET /api/users/{userId}/memberships
Get all brigade memberships for a user.

**Response (200):**
```json
[
  {
    "id": "string",
    "brigadeId": "string",
    "userId": "string",
    "role": "admin|operator|viewer",
    "status": "pending|active|suspended|removed",
    ...
  }
]
```

## Brigade Members API

Base path: `/api/brigades/{brigadeId}/members`

### GET /api/brigades/{brigadeId}/members
List all members of a brigade.

**Response (200):** Array of `BrigadeMembership` objects

### POST /api/brigades/{brigadeId}/members/invite
Invite a user to join the brigade.

**Request Body:**
```json
{
  "email": "string",
  "role": "operator|viewer",
  "invitedBy": "string (userId)",
  "personalMessage": "string (optional)"
}
```

**Response (201):** Created `MemberInvitation` object

**Notes:**
- Invitation expires after 7 days
- Generates unique token for acceptance link

### DELETE /api/brigades/{brigadeId}/members/{userId}
Remove a member from the brigade.

**Response (200):**
```json
{
  "message": "Member removed successfully"
}
```

**Errors:**
- `404` - Membership not found

### PATCH /api/brigades/{brigadeId}/members/{userId}/role
Change a member's role.

**Request Body:**
```json
{
  "role": "admin|operator|viewer"
}
```

**Response (200):** Updated `BrigadeMembership` object

**Errors:**
- `400` - Invalid role
- `404` - Membership not found

### GET /api/brigades/{brigadeId}/members/pending
Get all pending membership approvals.

**Response (200):** Array of `BrigadeMembership` objects with `status: 'pending'`

### POST /api/brigades/{brigadeId}/members/{userId}/approve
Approve a pending membership.

**Request Body:**
```json
{
  "approvedBy": "string (userId)"
}
```

**Response (200):** Updated `BrigadeMembership` object with `status: 'active'`

**Errors:**
- `400` - Membership is not pending
- `404` - Membership not found

## Brigade Claiming API

Base path: `/api/brigades/{brigadeId}/claim`

### POST /api/brigades/{brigadeId}/claim
Claim an unclaimed brigade.

**Request Body:**
```json
{
  "userId": "string"
}
```

**Response (200):**
```json
{
  "brigade": { ... },
  "membership": { ... }
}
```

**Eligibility:**
- User must have `.gov.au` email OR approved verification for the brigade
- Brigade must not already be claimed

**Errors:**
- `403` - Not authorized to claim (no .gov.au email or verification)
- `404` - Brigade or user not found
- `409` - Brigade already claimed

## Invitations API

Base path: `/api/invitations`

### GET /api/invitations/{token}
Get invitation details by token.

**Response (200):** `MemberInvitation` object

**Notes:**
- Automatically marks as expired if past `expiresAt`

### POST /api/invitations/{token}/accept
Accept an invitation.

**Request Body:**
```json
{
  "userId": "string"
}
```

**Response (200):**
```json
{
  "invitation": { ... },
  "membership": { ... }
}
```

**Errors:**
- `400` - Invitation not pending or expired
- `404` - Invitation not found

### POST /api/invitations/{token}/decline
Decline an invitation.

**Response (200):** Updated `MemberInvitation` with `status: 'declined'`

### DELETE /api/invitations/{invitationId}?brigadeId=xxx
Cancel an invitation.

**Query Parameters:**
- `brigadeId` - Required for partition key lookup

**Response (200):**
```json
{
  "message": "Invitation cancelled successfully"
}
```

**Errors:**
- `400` - Invitation not pending
- `404` - Invitation not found

## Verification API

Base path: `/api/verification`

User-facing endpoints for submitting admin verification requests.

### POST /api/verification/request
Submit a verification request (for non-.gov.au users).

**Request Body:**
```json
{
  "userId": "string",
  "brigadeId": "string",
  "email": "string",
  "explanation": "string (50-500 chars)",
  "evidenceFiles": [
    {
      "id": "string",
      "filename": "string",
      "contentType": "string",
      "size": number,
      "url": "string",
      "uploadedAt": "ISO 8601 timestamp"
    }
  ]
}
```

**Response (201):** Created `AdminVerificationRequest` object

**Validation:**
- Explanation must be 50-500 characters
- `.gov.au` emails cannot use verification system
- Request expires after 30 days

**Errors:**
- `400` - Invalid data or .gov.au email
- `409` - Request already exists

### GET /api/verification/requests/{requestId}?userId=xxx
Get verification request details.

**Query Parameters:**
- `userId` - Required for partition key lookup

**Response (200):** `AdminVerificationRequest` object

### GET /api/verification/user/{userId}
Get all verification requests for a user.

**Response (200):** Array of `AdminVerificationRequest` objects

## Admin Verification API

Base path: `/api/admin/verification`

Site owner only endpoints for reviewing verification requests.

⚠️ **Note:** These endpoints should be secured in production with proper authentication and authorization checks.

### GET /api/admin/verification/pending
List all pending verification requests.

**Response (200):** Array of pending `AdminVerificationRequest` objects

**Notes:**
- Automatically marks expired requests

### GET /api/admin/verification/requests/{requestId}?userId=xxx
Get verification request details with full evidence.

**Query Parameters:**
- `userId` - Required for partition key lookup

**Response (200):** `AdminVerificationRequest` object with evidence files

### POST /api/admin/verification/requests/{requestId}/approve?userId=xxx
Approve a verification request.

**Query Parameters:**
- `userId` - Required for partition key lookup

**Request Body:**
```json
{
  "reviewedBy": "string (siteOwnerId)",
  "reviewNotes": "string (optional, private)"
}
```

**Response (200):** Updated `AdminVerificationRequest` with `status: 'approved'`

**Side Effects:**
- Adds brigade to user's `verifiedBrigades` array
- User can now claim the brigade or be promoted to admin

**Errors:**
- `400` - Request not pending or expired
- `404` - Request or user not found

### POST /api/admin/verification/requests/{requestId}/reject?userId=xxx
Reject a verification request.

**Query Parameters:**
- `userId` - Required for partition key lookup

**Request Body:**
```json
{
  "reviewedBy": "string (siteOwnerId)",
  "reviewNotes": "string (required, private reason)"
}
```

**Response (200):** Updated `AdminVerificationRequest` with `status: 'rejected'`

**Errors:**
- `400` - Request not pending
- `404` - Request not found

## Azure Table Storage Schema

All endpoints use Azure Table Storage with environment-based table names:
- Dev mode: `dev{tablename}` (e.g., `devusers`, `devmemberships`)
- Production: `{tablename}` (e.g., `users`, `memberships`)

### Table Schemas

**users**
- Partition Key: `userId`
- Row Key: `userId`

**memberships**
- Partition Key: `brigadeId`
- Row Key: `membershipId`
- Additional Index: `userId` (for querying user's memberships)

**invitations**
- Partition Key: `brigadeId`
- Row Key: `invitationId`
- Additional Index: `token` (for invitation acceptance)

**verificationrequests**
- Partition Key: `userId`
- Row Key: `requestId`
- Additional Index: `status` (for querying pending requests)

## Error Handling

All endpoints follow consistent error response format:

```json
{
  "error": "Human-readable error message",
  "message": "Technical error details (optional)"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad request (missing/invalid data)
- `403` - Forbidden (authorization failure)
- `404` - Not found
- `409` - Conflict (duplicate resource)
- `500` - Internal server error

## Testing

Use tools like Postman, curl, or the Azure Functions test panel to test endpoints.

Example curl commands:

```bash
# Register user
curl -X POST http://localhost:7071/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"id":"user-123","email":"test@example.com","name":"Test User"}'

# Claim brigade
curl -X POST http://localhost:7071/api/brigades/brigade-123/claim \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-123"}'

# Invite member
curl -X POST http://localhost:7071/api/brigades/brigade-123/members/invite \
  -H "Content-Type: application/json" \
  -d '{"email":"member@example.com","role":"operator","invitedBy":"user-123"}'
```

## Phase 7 Integration

In Phase 7, these endpoints will be enhanced with:
- Microsoft Entra External ID authentication
- Authorization checks (role-based access control)
- Azure Blob Storage for evidence file uploads
- SAS token generation for secure file access
- Email notifications for invitations and verifications
