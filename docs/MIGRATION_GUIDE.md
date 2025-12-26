# Migration Guide - Phase 6a Data Schema Updates

This document describes the migration path from the current Brigade/Route model to the new multi-user authentication and membership system.

## Overview

Phase 6a introduces significant data model changes to support:
- Individual user accounts
- Multi-brigade membership
- Role-based access control (admin, operator, viewer)
- Brigade claiming workflow
- Admin verification for non-.gov.au emails

## Data Model Changes

### New Entities

1. **User** (`src/types/user.ts`)
   - Replaces email-based identification
   - Supports Microsoft Entra External ID
   - Tracks verified brigades for non-.gov.au users

2. **BrigadeMembership** (`src/types/membership.ts`)
   - Many-to-many relationship between users and brigades
   - Tracks role and status per brigade
   - Audit trail (invited by, approved by, etc.)

3. **MemberInvitation** (`src/types/invitation.ts`)
   - Token-based invitation system
   - 7-day expiration
   - Status tracking

4. **AdminVerificationRequest** (`src/types/verification.ts`)
   - Evidence-based verification for non-.gov.au users
   - Site owner review workflow
   - 30-day expiration

### Updated Entities

1. **Brigade** Interface Changes:
   ```typescript
   // OLD (Phase 5 and earlier)
   interface Brigade {
     id: string;
     name: string;
     // ... other fields
     requireApproval?: boolean;
   }

   // NEW (Phase 6a)
   interface Brigade {
     id: string;
     name: string;
     // ... other fields
     adminUserIds: string[];              // NEW: Array of admin user IDs
     isClaimed: boolean;                  // NEW: Claiming status
     claimedAt?: string;                  // NEW: When claimed
     claimedBy?: string;                  // NEW: User who claimed
     requireManualApproval: boolean;      // RENAMED from requireApproval
     rfsStationId?: string;               // NEW: RFS dataset integration
   }
   ```

2. **Route** Interface Changes:
   ```typescript
   // OLD (Phase 5 and earlier)
   interface Route {
     // ... fields
     createdBy: string;  // Email address
   }

   // NEW (Phase 6a)
   interface Route {
     // ... fields
     createdBy: string;  // User ID (UUID)
   }
   ```

## Migration Strategy

### Phase 1: Add New Fields to Existing Brigades

For existing brigades in production:

```typescript
// Migration script pseudo-code
async function migrateBrigades() {
  const brigades = await storageAdapter.listBrigades();
  
  for (const brigade of brigades) {
    // Mark all existing brigades as claimed
    brigade.isClaimed = true;
    brigade.claimedAt = brigade.createdAt; // Use creation date
    
    // Generate user IDs from admin emails if available
    if (brigade.contactEmail) {
      // Look up or create user for admin
      const adminUser = await getOrCreateUser(brigade.contactEmail);
      brigade.adminUserIds = [adminUser.id];
      brigade.claimedBy = adminUser.id;
    } else {
      // No admin yet - mark as claimed but no admin
      brigade.adminUserIds = [];
    }
    
    // Rename requireApproval field
    brigade.requireManualApproval = brigade.requireApproval || false;
    delete brigade.requireApproval;
    
    await storageAdapter.saveBrigade(brigade);
  }
}
```

### Phase 2: Create Users for Existing Admins

```typescript
async function createUsersForExistingAdmins() {
  const brigades = await storageAdapter.listBrigades();
  
  for (const brigade of brigades) {
    if (brigade.contactEmail && brigade.adminUserIds.length === 0) {
      // Create user account
      const user: User = {
        id: generateUUID(),
        email: brigade.contactEmail,
        name: extractNameFromEmail(brigade.contactEmail),
        emailVerified: false,
        verifiedBrigades: [],
        createdAt: new Date().toISOString(),
      };
      
      await storageAdapter.saveUser(user);
      
      // Create admin membership
      const membership: BrigadeMembership = {
        id: generateUUID(),
        brigadeId: brigade.id,
        userId: user.id,
        role: 'admin',
        status: 'active',
        joinedAt: brigade.createdAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      await storageAdapter.saveMembership(membership);
      
      // Update brigade with admin user ID
      brigade.adminUserIds = [user.id];
      brigade.claimedBy = user.id;
      await storageAdapter.saveBrigade(brigade);
    }
  }
}
```

### Phase 3: Migrate Route References

```typescript
async function migrateRouteCreators() {
  const routes = await storageAdapter.listRoutes();
  const emailToUserId = new Map<string, string>();
  
  for (const route of routes) {
    if (route.createdBy && route.createdBy.includes('@')) {
      // Old format: email address
      const email = route.createdBy;
      
      // Look up or cache user ID
      if (!emailToUserId.has(email)) {
        const user = await storageAdapter.getUserByEmail(email);
        if (user) {
          emailToUserId.set(email, user.id);
        } else {
          // Create placeholder user
          const newUser = await createPlaceholderUser(email);
          emailToUserId.set(email, newUser.id);
        }
      }
      
      // Update route with user ID
      route.createdBy = emailToUserId.get(email)!;
      await storageAdapter.saveRoute(route);
    }
  }
}
```

### Phase 4: Import RFS Dataset as Unclaimed Brigades

```typescript
async function seedRFSDataset() {
  const rfsStations = await fetchRFSStations();
  
  for (const station of rfsStations) {
    // Check if brigade already exists
    const existing = await findBrigadeByRFSStationId(station.id);
    if (existing) continue;
    
    // Create unclaimed brigade
    const brigade: Brigade = {
      id: generateUUID(),
      name: station.name,
      location: station.location,
      contactEmail: '',
      contactPhone: '',
      allowedDomains: [],
      adminUserIds: [],
      isClaimed: false,           // Unclaimed!
      requireManualApproval: true,
      rfsStationId: station.id,   // Link to RFS dataset
      createdAt: new Date().toISOString(),
    };
    
    await storageAdapter.saveBrigade(brigade);
  }
}
```

## Storage Adapter Compatibility

### localStorage Adapter
- No migration needed (starts fresh)
- All new entities supported
- Use for local development

### Azure Table Storage Adapter
- Tables created automatically on first write
- Supports all new entity types
- Dev mode uses `dev` prefix for tables
- Production uses standard table names

### Table Structure

```
Azure Tables:
├── users (or devusers)
│   ├── PartitionKey: userId
│   └── RowKey: userId
├── memberships (or devmemberships)
│   ├── PartitionKey: brigadeId
│   └── RowKey: membershipId
├── invitations (or devinvitations)
│   ├── PartitionKey: brigadeId
│   └── RowKey: invitationId
├── verificationrequests (or devverificationrequests)
│   ├── PartitionKey: userId
│   └── RowKey: requestId
├── brigades (or devbrigades)
│   ├── PartitionKey: brigadeId
│   └── RowKey: brigadeId
└── routes (or devroutes)
    ├── PartitionKey: brigadeId
    └── RowKey: routeId
```

## Development Mode Strategy

### Without Existing Data
1. Start with empty database
2. Use RFS seeding script to populate unclaimed brigades
3. Test claiming workflow
4. Test invitation and membership flows

### With Existing Data
1. Run migration scripts in order
2. Verify all brigades have correct claiming status
3. Verify routes reference user IDs
4. Test new workflows

## Testing the Migration

### Verification Checklist

- [ ] All existing brigades marked as claimed
- [ ] All existing brigades have at least one admin user
- [ ] All admin users have corresponding User records
- [ ] All admin users have active memberships
- [ ] All routes reference user IDs (not emails)
- [ ] RFS dataset imported as unclaimed brigades
- [ ] New claiming workflow works
- [ ] Invitation system works
- [ ] Verification system works

### Test Scenarios

1. **Claimed Brigade Management**
   - Existing admin can invite new members
   - Members can be promoted to operators
   - Operators can create routes
   - Admins can remove members

2. **Unclaimed Brigade Claiming**
   - User with .gov.au email can claim
   - User with approved verification can claim
   - User without either cannot claim

3. **Multi-Brigade Membership**
   - User can be member of multiple brigades
   - Different roles in different brigades
   - Proper data isolation

4. **Verification Workflow**
   - Non-.gov.au user submits verification
   - Site owner reviews and approves
   - User can then claim brigade
   - Approved verification tracked in user record

## Rollback Plan

If issues arise during migration:

1. **Backup Data**: Always backup before migration
2. **Revert Schema**: Remove new fields from brigades
3. **Restore Routes**: Convert user IDs back to emails
4. **Delete New Tables**: Remove users, memberships, invitations, verifications

## Common Migration Issues

### Issue: Brigade Has No Admin Email
**Solution:** Mark as unclaimed or manually assign admin

### Issue: Route Creator Email Not Found
**Solution:** Create placeholder user with email

### Issue: Duplicate Users
**Solution:** Merge users or keep most recent

### Issue: Lost Membership Records
**Solution:** Regenerate from brigade adminUserIds

## Timeline

1. **Week 6** - Schema updates and storage adapters (✅ Completed)
2. **Week 7** - API endpoints and business logic (✅ Completed)
3. **Week 7-8** - Phase 7: Authentication integration
4. **Week 8** - Migration script development
5. **Week 8** - Migration testing
6. **Week 9** - Production migration

## Support

For migration issues:
1. Check existing data in Azure Portal
2. Review MASTER_PLAN.md for schema details
3. Test migration scripts in dev environment first
4. Keep backups of all data

## Next Steps

After successful migration:
1. Enable Phase 7 authentication
2. Send invitation emails to existing brigade members
3. Enable claiming workflow for RFS brigades
4. Monitor verification requests
5. Begin Phase 8 features
