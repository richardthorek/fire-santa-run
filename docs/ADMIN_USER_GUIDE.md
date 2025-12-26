# Admin User Guide - Brigade Membership Management

## Overview

This guide provides comprehensive instructions for brigade administrators on managing members, invitations, and roles within the Fire Santa Run application.

## Table of Contents

1. [Admin Role Requirements](#admin-role-requirements)
2. [Accessing Member Management](#accessing-member-management)
3. [Inviting New Members](#inviting-new-members)
4. [Managing Pending Approvals](#managing-pending-approvals)
5. [Changing Member Roles](#changing-member-roles)
6. [Promoting and Demoting Admins](#promoting-and-demoting-admins)
7. [Removing Members](#removing-members)
8. [Domain Whitelist Configuration](#domain-whitelist-configuration)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Admin Role Requirements

### What is an Admin?

Admins have full control over brigade membership and settings:
- Invite and approve members
- Promote/demote other admins
- Remove members
- Manage routes
- Edit brigade settings
- Start navigation

### Requirements to Become Admin

1. **Email Domain**: Must have a `.gov.au` email address
2. **Brigade Limit**: Maximum 2 admins per brigade
3. **Promotion**: Must be promoted by an existing admin

### Why .gov.au is Required

Admin roles require government email addresses to ensure official fire service personnel manage brigade operations.

---

## Accessing Member Management

### Navigate to Member Management

1. **Login** to the Fire Santa Run application
2. **Select your brigade** from the dashboard
3. **Click "Members"** in the navigation menu
4. You'll see the **Member Management** page with:
   - Current members list
   - Pending invitations
   - Pending approvals (admins only)

### Member Management Page Layout

```
┌─────────────────────────────────────────┐
│ Brigade Members                         │
├─────────────────────────────────────────┤
│ [+ Invite Member]                       │
├─────────────────────────────────────────┤
│ Active Members (5)                      │
│ ├─ John Smith (Admin) 🔥               │
│ ├─ Mary Johnson (Operator) ⚡          │
│ └─ Bob Wilson (Viewer) 👀              │
├─────────────────────────────────────────┤
│ Pending Invitations (2)                 │
│ ├─ alice@fire.nsw.gov.au (Operator)   │
│ └─ david@example.com (Viewer)          │
├─────────────────────────────────────────┤
│ Pending Approvals (1) [Admins Only]    │
│ └─ volunteer@gmail.com (Operator)      │
│    [Approve] [Reject]                   │
└─────────────────────────────────────────┘
```

---

## Inviting New Members

### Step-by-Step Guide

1. **Click "Invite Member"** button
2. **Fill in invitation form**:
   - **Email**: Member's email address
   - **Role**: Select role (Operator, Viewer, or Admin)
   - **Personal Message**: Optional welcome message
3. **Click "Send Invitation"**
4. Member receives invitation email with acceptance link

### Role Selection Guidelines

Choose the appropriate role based on member's responsibilities:

| Role | When to Use | Permissions |
|------|-------------|-------------|
| **Viewer** | Public supporters, families | View members only |
| **Operator** | Active brigade volunteers | Create routes, start navigation, view members |
| **Admin** | Brigade captain, deputy | Full brigade management |

### Email Domain Considerations

**Automatic Approval:**
- If email domain is whitelisted (e.g., `fire.nsw.gov.au`)
- Member is automatically approved upon accepting invitation

**Manual Approval Required:**
- If email domain is not whitelisted (e.g., `gmail.com`)
- Admin must manually approve after member accepts

### Example: Inviting an Operator

```
Email: john.smith@fire.nsw.gov.au
Role: Operator
Message: Welcome to the brigade! You'll be able to create and manage Santa routes.

[Send Invitation]
```

---

## Managing Pending Approvals

### What are Pending Approvals?

Members who have accepted invitations but require manual admin approval before gaining access.

### When Manual Approval is Required

- Email domain not in brigade whitelist
- Personal email addresses (gmail.com, outlook.com, etc.)
- First-time brigade members

### Approving Members

1. **Navigate** to "Pending Approvals" section (admins only)
2. **Review** member details:
   - Email address
   - Requested role
   - Invitation date
3. **Verify** member's identity (contact them if needed)
4. **Click "Approve"** to grant access
5. Member immediately gains access to the brigade

### Rejecting Members

1. **Review** member request
2. **Click "Reject"** if member should not have access
3. Member receives rejection notification
4. Member can request verification through alternate process

### Best Practices

✅ **DO:**
- Verify member identity before approving
- Contact unknown members to confirm legitimacy
- Approve promptly to avoid delays

❌ **DON'T:**
- Approve members you don't recognize without verification
- Approve personal emails for admin roles
- Ignore pending approvals for extended periods

---

## Changing Member Roles

### When to Change Roles

- Member takes on more responsibilities → Promote
- Member stepping back from active duty → Demote
- Temporary role changes for specific events

### How to Change Roles

1. **Locate member** in the member list
2. **Click role dropdown** next to member's name
3. **Select new role** (Viewer, Operator, or Admin)
4. **Confirm change** in dialog
5. Role updates immediately

### Role Change Rules

- **Operator → Admin**: Requires `.gov.au` email
- **Admin → Operator**: Must maintain at least 1 admin
- **Any → Viewer**: Always allowed
- **Viewer → Operator**: Always allowed

### Example Scenarios

**Scenario 1: Promoting Active Volunteer**
```
Member: Mary Johnson (Viewer)
Action: Promote to Operator
Reason: Taking on route planning duties
Result: Can now create routes and start navigation
```

**Scenario 2: Demoting Inactive Admin**
```
Member: Bob Wilson (Admin)
Action: Demote to Operator
Check: Ensure at least 1 other admin remains
Result: Loses admin privileges but keeps route management
```

---

## Promoting and Demoting Admins

### Admin Management Rules

**Maximum Admins**: 2 per brigade  
**Minimum Admins**: 1 per brigade  
**Email Requirement**: `.gov.au` domain mandatory

### Promoting to Admin

#### Requirements Check

1. **Email domain**: Must be `.gov.au`
2. **Admin count**: Maximum 2 admins allowed
3. **Current role**: Must be Operator or Viewer

#### Promotion Steps

1. **Verify email** ends with `.gov.au`
2. **Click role dropdown** next to member's name
3. **Select "Admin"**
4. **Confirm promotion** in warning dialog:
   ```
   ⚠️ Promote to Admin?
   
   This will grant full brigade management permissions to:
   John Smith (john.smith@fire.nsw.gov.au)
   
   Admin permissions include:
   - Invite and approve members
   - Promote/demote other admins
   - Remove members
   - Edit brigade settings
   
   [Cancel] [Promote to Admin]
   ```
5. Member immediately gains admin access

#### What if Email is Not .gov.au?

```
❌ Cannot promote to admin

Member's email (volunteer@gmail.com) is not from a
.gov.au domain. Admin roles require official government
email addresses.

To proceed:
1. Ask member to provide .gov.au email
2. Update their account email
3. Try promotion again
```

### Demoting from Admin

#### Safeguards

- **Cannot demote last admin** - Brigade must have at least 1 admin
- **Confirmation required** - Prevents accidental demotions
- **Auto-assignment** - Demoted admin becomes Operator by default

#### Demotion Steps

1. **Verify** another admin exists (can't demote last admin)
2. **Click role dropdown** next to admin's name
3. **Select "Operator"** or "Viewer"
4. **Confirm demotion** in warning dialog:
   ```
   ⚠️ Demote from Admin?
   
   This will remove admin permissions from:
   Mary Johnson (mary@fire.nsw.gov.au)
   
   They will become an Operator and lose:
   - Member approval rights
   - Admin promotion rights
   - Brigade settings access
   
   [Cancel] [Demote to Operator]
   ```
5. Role updates immediately

#### Cannot Demote Last Admin

```
❌ Cannot demote admin

Mary Johnson is the only admin in this brigade.
Every brigade must have at least one admin.

To demote this admin:
1. Promote another member to admin first
2. Then demote this admin
```

---

## Removing Members

### When to Remove Members

- Member leaves brigade
- Member violates brigade policies
- Inactive members (after discussion)
- Duplicate or test accounts

### Removal Process

1. **Locate member** in member list
2. **Click "Remove"** button
3. **Confirm removal** in warning dialog:
   ```
   ⚠️ Remove Member?
   
   This will permanently remove:
   Bob Wilson (bob@example.com)
   
   They will lose all access to:
   - Brigade dashboard
   - Route management
   - Member information
   
   [Cancel] [Remove Member]
   ```
4. Member immediately loses access

### Admin Removal Restrictions

**Cannot remove last admin:**
```
❌ Cannot remove member

John Smith is the only admin in this brigade.
Every brigade must have at least one admin.

To remove this member:
1. Promote another member to admin first
2. Then remove this admin
```

### Self-Service Leave

Members can leave brigade voluntarily:
1. Go to **Profile** page
2. Click **"Leave Brigade"**
3. Confirm action
4. Loses all brigade access

**Note:** Last admin cannot leave until promoting a replacement.

---

## Domain Whitelist Configuration

### What is Domain Whitelisting?

Domain whitelisting allows automatic approval of members from trusted email domains, bypassing manual admin approval.

### Benefits

- **Faster onboarding** - Instant access for trusted domains
- **Reduced admin workload** - No manual approval needed
- **Better security** - Control which organizations are trusted

### Configuring Whitelist

#### Allowed Domains

Add trusted email domains that should be auto-approved:

```
Examples:
- fire.nsw.gov.au
- rfs.nsw.gov.au
- emergency.qld.gov.au
```

#### Allowed Emails

Add specific email addresses that should be auto-approved:

```
Examples:
- captain@brigade.org.au
- deputy@brigade.org.au
- volunteer.coordinator@brigade.org.au
```

### How to Configure

1. **Navigate** to brigade settings
2. **Scroll** to "Member Approval Settings"
3. **Add domains** to "Allowed Domains" field
4. **Add emails** to "Allowed Emails" field
5. **Save settings**

### Auto-Approval Logic

When member accepts invitation:

1. **Check email** - Is it in "Allowed Emails"? → Auto-approve ✅
2. **Check domain** - Is domain in "Allowed Domains"? → Auto-approve ✅
3. **Neither** - Require manual approval ⏳

### Example Configuration

```yaml
Brigade: Sydney Central RFS

Allowed Domains:
  - fire.nsw.gov.au
  - rfs.nsw.gov.au

Allowed Emails:
  - captain@sydneycentral.org.au
  - deputy@sydneycentral.org.au

Results:
  john@fire.nsw.gov.au → Auto-approved ✅
  mary@rfs.nsw.gov.au → Auto-approved ✅
  captain@sydneycentral.org.au → Auto-approved ✅
  volunteer@gmail.com → Manual approval ⏳
```

---

## Best Practices

### Security

1. ✅ **Verify member identities** before approving
2. ✅ **Use .gov.au emails** for admins
3. ✅ **Configure domain whitelist** for trusted organizations
4. ✅ **Remove inactive members** regularly
5. ✅ **Maintain 2 admins** for redundancy

### Communication

1. ✅ **Welcome new members** with personal messages
2. ✅ **Explain roles** clearly in invitations
3. ✅ **Notify members** of role changes
4. ✅ **Document removal reasons** internally
5. ✅ **Respond promptly** to member requests

### Management

1. ✅ **Review membership** quarterly
2. ✅ **Update whitelist** as needed
3. ✅ **Promote based on contribution** and responsibility
4. ✅ **Keep admin count** at 2 for redundancy
5. ✅ **Train new admins** on management procedures

---

## Troubleshooting

### Cannot Invite Member

**Problem:** "Invitation already exists" error  
**Solution:** Member may have pending invitation - check "Pending Invitations" section

**Problem:** Invalid email format  
**Solution:** Verify email address is correct and properly formatted

### Cannot Promote to Admin

**Problem:** "Email must be from .gov.au domain"  
**Solution:** Member needs official government email address

**Problem:** "Maximum 2 admins allowed"  
**Solution:** Demote an existing admin first

### Cannot Remove Member

**Problem:** "Cannot remove last admin"  
**Solution:** Promote another member to admin first

**Problem:** Member already removed  
**Solution:** Refresh page - may be cached data

### Member Not Receiving Invitation

**Problem:** Invitation email not received  
**Solution:** 
1. Check spam/junk folder
2. Verify email address is correct
3. Resend invitation
4. Contact member to check email filters

### Domain Whitelist Not Working

**Problem:** Members still requiring manual approval  
**Solution:**
1. Verify domain is added to whitelist
2. Check domain spelling exactly matches email
3. Save settings after adding domain
4. Test with new invitation

---

## Getting Help

### Contact Support

- **Technical Issues**: Email support@firesantarun.com.au
- **Account Issues**: Email accounts@firesantarun.com.au
- **Brigade Setup**: Contact your regional coordinator

### Additional Resources

- [API Authentication Documentation](./API_AUTHENTICATION.md)
- [Deployment Guide](./AZURE_SETUP.md)
- [Entra External ID Setup](./ENTRA_EXTERNAL_ID_SETUP.md)
- [Master Plan](../MASTER_PLAN.md)

---

## Quick Reference

### Admin Permissions

| Action | Admin | Operator | Viewer |
|--------|-------|----------|--------|
| View members | ✅ | ✅ | ✅ |
| Invite members | ✅ | ❌ | ❌ |
| Approve members | ✅ | ❌ | ❌ |
| Remove members | ✅ | ❌ | ❌ |
| Change roles | ✅ | ❌ | ❌ |
| Promote admins | ✅ | ❌ | ❌ |
| Create routes | ✅ | ✅ | ❌ |
| Edit brigade | ✅ | ❌ | ❌ |

### Email Requirements

| Role | Email Requirement |
|------|-------------------|
| Admin | Must be `.gov.au` |
| Operator | Any valid email |
| Viewer | Any valid email |

### Brigade Limits

| Item | Limit |
|------|-------|
| Admins | Minimum 1, Maximum 2 |
| Total Members | No limit |
| Pending Invitations | No limit |
| Pending Approvals | No limit |
