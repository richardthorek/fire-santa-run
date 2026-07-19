/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * /api/users - Users CRUD API
 *
 * Handles local profile fields not already covered by the Station Manager
 * session (id/email/name come fresh from the token on every request) —
 * currently just an avatar. Users are stored in Azure Table Storage with
 * userId as both partition and row key.
 *
 * Endpoints:
 * - POST /api/users/register - User registration
 * - GET /api/users/{userId} - Get user profile
 * - PATCH /api/users/{userId} - Update user profile
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getTableClient, isDevMode } from './utils/storage';
import { validateToken } from './utils/auth';

async function requireUser(request: HttpRequest): Promise<{ userId?: string } | HttpResponseInit> {
  const authResult = await validateToken(request);
  if (!authResult.authenticated) {
    return { status: 401, jsonBody: { error: 'Unauthorized', message: authResult.error || 'Authentication required' } };
  }
  return { userId: authResult.userId };
}

function isDenied(result: { userId?: string } | HttpResponseInit): result is HttpResponseInit {
  return typeof (result as HttpResponseInit).status === 'number';
}
const USERS_TABLE = isDevMode ? 'dev-users' : 'users';

async function getUsersTableClient() {
  return getTableClient(USERS_TABLE);
}

function entityToUser(entity: any) {
  return {
    id: entity.rowKey,
    email: entity.email,
    name: entity.name,
    emailVerified: entity.emailVerified === true,
    createdAt: entity.createdAt,
    lastLoginAt: entity.lastLoginAt,
    profilePicture: entity.profilePicture,
  };
}

function userToEntity(user: any) {
  return {
    partitionKey: user.id,
    rowKey: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    profilePicture: user.profilePicture,
  };
}

function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''");
}

// POST /api/users/register
async function registerUser(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const auth = await requireUser(request);
    if (isDenied(auth)) return auth;

    const user = await request.json() as any;

    if (!user.id || !user.email || !user.name) {
      return { status: 400, jsonBody: { error: 'Missing required fields: id, email, name' } };
    }

    if (user.id !== auth.userId) {
      return { status: 403, jsonBody: { error: 'Forbidden', message: 'You can only register your own account' } };
    }

    const client = await getUsersTableClient();
    const entity = userToEntity({ ...user, emailVerified: false, createdAt: new Date().toISOString() });

    await client.createEntity(entity);
    context.log(`Registered user: ${user.id} (${user.email})`);

    return { status: 201, jsonBody: entityToUser(entity) };
  } catch (error: any) {
    context.error('Error registering user:', error);
    if (error.statusCode === 409) return { status: 409, jsonBody: { error: 'User already exists' } };
    return { status: 500, jsonBody: { error: 'Failed to register user', message: error instanceof Error ? error.message : 'Unknown error' } };
  }
}

// GET /api/users/{userId}
async function getUser(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const auth = await requireUser(request);
    if (isDenied(auth)) return auth;

    const userId = request.params.userId;
    if (!userId) return { status: 400, jsonBody: { error: 'Missing required parameter: userId' } };

    const client = await getUsersTableClient();
    const entity = await client.getEntity(userId, userId);
    context.log(`Retrieved user: ${userId}`);
    return { status: 200, jsonBody: entityToUser(entity) };
  } catch (error: any) {
    context.error('Error retrieving user:', error);
    if (error.statusCode === 404) return { status: 404, jsonBody: { error: 'User not found' } };
    return { status: 500, jsonBody: { error: 'Failed to retrieve user', message: error instanceof Error ? error.message : 'Unknown error' } };
  }
}

// GET /api/users/by-email/{email}
async function getUserByEmail(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const auth = await requireUser(request);
    if (isDenied(auth)) return auth;

    const email = request.params.email;
    if (!email) return { status: 400, jsonBody: { error: 'Missing required parameter: email' } };

    const client = await getUsersTableClient();
    const escapedExact = escapeODataValue(email);
    const escapedLower = escapeODataValue(email.toLowerCase());

    try {
      const entities = client.listEntities({ queryOptions: { filter: `email eq '${escapedExact}'` } });
      for await (const entity of entities) {
        context.log(`Retrieved user by exact email: ${email}`);
        return { status: 200, jsonBody: entityToUser(entity) };
      }
    } catch (err: any) {
      context.warn('Exact email filter failed, will fall back to more compatible strategies', err?.message || err);
    }

    try {
      const entities = client.listEntities({ queryOptions: { filter: `tolower(email) eq '${escapedLower}'` } });
      for await (const entity of entities) {
        context.log(`Retrieved user by case-insensitive email (server-side): ${email}`);
        return { status: 200, jsonBody: entityToUser(entity) };
      }
    } catch (err: any) {
      context.warn('Server-side case-insensitive filter not supported, falling back to client-side scan', err?.message || err);
    }

    for await (const entity of client.listEntities()) {
      if (entity.email && String(entity.email).toLowerCase() === email.toLowerCase()) {
        context.log(`Retrieved user by email via client-side scan: ${email}`);
        return { status: 200, jsonBody: entityToUser(entity) };
      }
    }

    return { status: 404, jsonBody: { error: 'User not found' } };
  } catch (error: any) {
    context.error('Error retrieving user by email:', error);
    return { status: 500, jsonBody: { error: 'Failed to retrieve user by email', message: error instanceof Error ? error.message : 'Unknown error' } };
  }
}

// PUT /api/users - Create or update user
async function saveUser(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const auth = await requireUser(request);
    if (isDenied(auth)) return auth;

    const user = await request.json() as any;

    if (!user.id || !user.email || !user.name) {
      return { status: 400, jsonBody: { error: 'Missing required fields: id, email, name' } };
    }
    if (user.id !== auth.userId) {
      return { status: 403, jsonBody: { error: 'Forbidden', message: 'You can only modify your own account' } };
    }

    const client = await getUsersTableClient();

    try {
      await client.getEntity(user.id, user.id);
      const entity = userToEntity(user);
      await client.updateEntity(entity, 'Merge');
      context.log(`Updated user: ${user.id} (${user.email})`);
      return { status: 200, jsonBody: entityToUser(entity) };
    } catch (error: any) {
      if (error.statusCode === 404) {
        const entity = userToEntity(user);
        await client.createEntity(entity);
        context.log(`Created user: ${user.id} (${user.email})`);
        return { status: 201, jsonBody: entityToUser(entity) };
      }
      throw error;
    }
  } catch (error: any) {
    context.error('Error saving user:', error);
    return { status: 500, jsonBody: { error: 'Failed to save user', message: error instanceof Error ? error.message : 'Unknown error' } };
  }
}

// PATCH /api/users/{userId}
async function updateUser(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const auth = await requireUser(request);
    if (isDenied(auth)) return auth;

    const userId = request.params.userId;
    const updates = await request.json() as any;
    if (!userId) return { status: 400, jsonBody: { error: 'Missing required parameter: userId' } };
    if (userId !== auth.userId) {
      return { status: 403, jsonBody: { error: 'Forbidden', message: 'You can only modify your own account' } };
    }

    const client = await getUsersTableClient();
    const existingEntity = await client.getEntity(userId, userId);
    const existingUser = entityToUser(existingEntity);

    const updatedUser = {
      ...existingUser,
      name: updates.name !== undefined ? updates.name : existingUser.name,
      profilePicture: updates.profilePicture !== undefined ? updates.profilePicture : existingUser.profilePicture,
      lastLoginAt: updates.lastLoginAt !== undefined ? updates.lastLoginAt : existingUser.lastLoginAt,
    };

    const entity = userToEntity(updatedUser);
    await client.updateEntity(entity, 'Merge');
    context.log(`Updated user: ${userId}`);

    return { status: 200, jsonBody: updatedUser };
  } catch (error: any) {
    context.error('Error updating user:', error);
    if (error.statusCode === 404) return { status: 404, jsonBody: { error: 'User not found' } };
    return { status: 500, jsonBody: { error: 'Failed to update user', message: error instanceof Error ? error.message : 'Unknown error' } };
  }
}

// Register HTTP endpoints
// IMPORTANT: Register more specific routes BEFORE generic routes with parameters
// to avoid route matching conflicts in Azure Functions routing

app.http('users-register', { methods: ['POST'], authLevel: 'anonymous', route: 'users/register', handler: registerUser });
app.http('users-get-by-email', { methods: ['GET'], authLevel: 'anonymous', route: 'users/by-email/{email}', handler: getUserByEmail });
app.http('users-save', { methods: ['PUT'], authLevel: 'anonymous', route: 'users', handler: saveUser });
app.http('users-get', { methods: ['GET'], authLevel: 'anonymous', route: 'users/{userId}', handler: getUser });
app.http('users-update', { methods: ['PATCH'], authLevel: 'anonymous', route: 'users/{userId}', handler: updateUser });
