/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * /api/users - Users CRUD API
 * 
 * Handles user registration, profile management, and membership queries.
 * Users are stored in Azure Table Storage with userId as both partition and row key.
 * 
 * Endpoints:
 * - POST /api/users/register - User registration
 * - GET /api/users/{userId} - Get user profile
 * - PATCH /api/users/{userId} - Update user profile
 * - GET /api/users/{userId}/memberships - Get user's brigade memberships
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';

// Get Azure Storage credentials
const STORAGE_CONNECTION_STRING = process.env.VITE_AZURE_STORAGE_CONNECTION_STRING || '';

// Determine table name based on environment
const isDevMode = process.env.VITE_DEV_MODE === 'true';
const USERS_TABLE = isDevMode ? 'devusers' : 'users';
const MEMBERSHIPS_TABLE = isDevMode ? 'devmemberships' : 'memberships';

function getUsersTableClient(): TableClient {
  if (!STORAGE_CONNECTION_STRING) {
    throw new Error('Azure Storage connection string not configured');
  }
  return TableClient.fromConnectionString(STORAGE_CONNECTION_STRING, USERS_TABLE);
}

function getMembershipsTableClient(): TableClient {
  if (!STORAGE_CONNECTION_STRING) {
    throw new Error('Azure Storage connection string not configured');
  }
  return TableClient.fromConnectionString(STORAGE_CONNECTION_STRING, MEMBERSHIPS_TABLE);
}

// Helper to convert Table entity to User object
function entityToUser(entity: any) {
  return {
    id: entity.rowKey,
    email: entity.email,
    name: entity.name,
    entraUserId: entity.entraUserId,
    emailVerified: entity.emailVerified === true,
    verifiedBrigades: entity.verifiedBrigades ? JSON.parse(entity.verifiedBrigades) : [],
    createdAt: entity.createdAt,
    lastLoginAt: entity.lastLoginAt,
    profilePicture: entity.profilePicture,
  };
}

// Helper to convert User to Table entity
function userToEntity(user: any) {
  return {
    partitionKey: user.id,
    rowKey: user.id,
    email: user.email,
    name: user.name,
    entraUserId: user.entraUserId,
    emailVerified: user.emailVerified,
    verifiedBrigades: user.verifiedBrigades ? JSON.stringify(user.verifiedBrigades) : JSON.stringify([]),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    profilePicture: user.profilePicture,
  };
}

// Helper to convert Table entity to Membership object
function entityToMembership(entity: any) {
  return {
    id: entity.rowKey,
    brigadeId: entity.partitionKey,
    userId: entity.userId,
    role: entity.role,
    status: entity.status,
    invitedBy: entity.invitedBy,
    invitedAt: entity.invitedAt,
    approvedBy: entity.approvedBy,
    approvedAt: entity.approvedAt,
    joinedAt: entity.joinedAt,
    removedAt: entity.removedAt,
    removedBy: entity.removedBy,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

/**
 * Escapes single quotes in OData filter values to prevent injection attacks.
 * Azure Table Storage uses single quotes for string literals in queries.
 * @param value The string value to escape
 * @returns Escaped string safe for use in OData filters
 */
function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''");
}

// POST /api/users/register
async function registerUser(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const user = await request.json() as any;

    if (!user.id || !user.email || !user.name) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required fields: id, email, name' }
      };
    }

    const client = getUsersTableClient();
    const entity = userToEntity({
      ...user,
      emailVerified: false,
      verifiedBrigades: [],
      createdAt: new Date().toISOString(),
    });

    await client.createEntity(entity);

    context.log(`Registered user: ${user.id} (${user.email})`);

    return {
      status: 201,
      jsonBody: entityToUser(entity)
    };

  } catch (error: any) {
    context.error('Error registering user:', error);
    
    if (error.statusCode === 409) {
      return {
        status: 409,
        jsonBody: { error: 'User already exists' }
      };
    }

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to register user',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// GET /api/users/{userId}
async function getUser(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const userId = request.params.userId;

    if (!userId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameter: userId' }
      };
    }

    const client = getUsersTableClient();
    const entity = await client.getEntity(userId, userId);

    context.log(`Retrieved user: ${userId}`);

    return {
      status: 200,
      jsonBody: entityToUser(entity)
    };

  } catch (error: any) {
    context.error('Error retrieving user:', error);
    
    if (error.statusCode === 404) {
      return {
        status: 404,
        jsonBody: { error: 'User not found' }
      };
    }

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to retrieve user',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// GET /api/users/by-email/{email}
async function getUserByEmail(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const email = request.params.email;

    if (!email) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameter: email' }
      };
    }

    const client = getUsersTableClient();
    
    // Query users table for matching email (case-insensitive using tolower)
    // Escape email to prevent OData injection attacks
    const escapedEmail = escapeODataValue(email.toLowerCase());
    const entities = client.listEntities({
      queryOptions: { filter: `tolower(email) eq '${escapedEmail}'` }
    });

    for await (const entity of entities) {
      context.log(`Retrieved user by email: ${email}`);
      return {
        status: 200,
        jsonBody: entityToUser(entity)
      };
    }

    // User not found
    return {
      status: 404,
      jsonBody: { error: 'User not found' }
    };

  } catch (error: any) {
    context.error('Error retrieving user by email:', error);

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to retrieve user by email',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// PUT /api/users - Create or update user
async function saveUser(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const user = await request.json() as any;

    if (!user.id || !user.email || !user.name) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required fields: id, email, name' }
      };
    }

    const client = getUsersTableClient();
    
    try {
      // Try to get existing user
      await client.getEntity(user.id, user.id);
      
      // User exists, update it
      const entity = userToEntity(user);
      await client.updateEntity(entity, 'Merge');
      
      context.log(`Updated user: ${user.id} (${user.email})`);

      return {
        status: 200,
        jsonBody: entityToUser(entity)
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        // User doesn't exist, create it
        const entity = userToEntity(user);
        await client.createEntity(entity);
        
        context.log(`Created user: ${user.id} (${user.email})`);

        return {
          status: 201,
          jsonBody: entityToUser(entity)
        };
      }
      throw error;
    }

  } catch (error: any) {
    context.error('Error saving user:', error);

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to save user',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// PATCH /api/users/{userId}
async function updateUser(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const userId = request.params.userId;
    const updates = await request.json() as any;

    if (!userId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameter: userId' }
      };
    }

    const client = getUsersTableClient();
    
    // Get existing user
    const existingEntity = await client.getEntity(userId, userId);
    const existingUser = entityToUser(existingEntity);

    // Merge updates (only allow updating specific fields)
    const updatedUser = {
      ...existingUser,
      name: updates.name !== undefined ? updates.name : existingUser.name,
      profilePicture: updates.profilePicture !== undefined ? updates.profilePicture : existingUser.profilePicture,
      lastLoginAt: updates.lastLoginAt !== undefined ? updates.lastLoginAt : existingUser.lastLoginAt,
    };

    const entity = userToEntity(updatedUser);
    await client.updateEntity(entity, 'Merge');

    context.log(`Updated user: ${userId}`);

    return {
      status: 200,
      jsonBody: updatedUser
    };

  } catch (error: any) {
    context.error('Error updating user:', error);
    
    if (error.statusCode === 404) {
      return {
        status: 404,
        jsonBody: { error: 'User not found' }
      };
    }

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to update user',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// GET /api/users/{userId}/memberships
async function getUserMemberships(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const userId = request.params.userId;

    if (!userId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameter: userId' }
      };
    }

    const client = getMembershipsTableClient();
    
    // Query all memberships for this user across all brigades
    // Escape userId to prevent OData injection attacks
    const escapedUserId = escapeODataValue(userId);
    const entities = client.listEntities({
      queryOptions: { filter: `userId eq '${escapedUserId}'` }
    });

    const memberships = [];
    for await (const entity of entities) {
      memberships.push(entityToMembership(entity));
    }

    context.log(`Retrieved ${memberships.length} memberships for user: ${userId}`);

    return {
      status: 200,
      jsonBody: memberships
    };

  } catch (error: any) {
    context.error('Error retrieving user memberships:', error);

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to retrieve user memberships',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Register HTTP endpoints
app.http('users-register', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'users/register',
  handler: registerUser
});

app.http('users-save', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'users',
  handler: saveUser
});

app.http('users-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'users/{userId}',
  handler: getUser
});

app.http('users-get-by-email', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'users/by-email/{email}',
  handler: getUserByEmail
});

app.http('users-update', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'users/{userId}',
  handler: updateUser
});

app.http('users-memberships', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'users/{userId}/memberships',
  handler: getUserMemberships
});
