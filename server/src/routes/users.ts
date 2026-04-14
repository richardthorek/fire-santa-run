/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { getTableClient, isDevMode } from '../utils/storage.js';

const USERS_TABLE = isDevMode ? 'dev-users' : 'users';
const MEMBERSHIPS_TABLE = isDevMode ? 'dev-memberships' : 'memberships';

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
    brigadeId: entity.brigadeId,
  };
}

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
    brigadeId: user.brigadeId,
  };
}

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

function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''");
}

export const usersRouter = new Hono();

usersRouter.post('/register', async (c) => {
  try {
    const user = await c.req.json() as any;
    if (!user.id || !user.email || !user.name) return c.json({ error: 'Missing required fields: id, email, name' }, 400);
    const client = await getTableClient(USERS_TABLE);
    const entity = userToEntity({ ...user, emailVerified: false, verifiedBrigades: [], createdAt: new Date().toISOString() });
    await client.createEntity(entity);
    console.log(`Registered user: ${user.id} (${user.email})`);
    return c.json(entityToUser(entity), 201);
  } catch (error: any) {
    console.error('Error registering user:', error);
    if (error.statusCode === 409) return c.json({ error: 'User already exists' }, 409);
    return c.json({ error: 'Failed to register user', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

usersRouter.get('/by-email/:email', async (c) => {
  try {
    const email = c.req.param('email');
    const client = await getTableClient(USERS_TABLE);
    const escapedExact = escapeODataValue(email);
    const escapedLower = escapeODataValue(email.toLowerCase());

    try {
      const entities = client.listEntities({ queryOptions: { filter: `email eq '${escapedExact}'` } });
      for await (const entity of entities) return c.json(entityToUser(entity));
    } catch (err) { console.warn('Exact email filter failed, falling back:', (err as Error)?.message); }

    try {
      const entities = client.listEntities({ queryOptions: { filter: `tolower(email) eq '${escapedLower}'` } });
      for await (const entity of entities) return c.json(entityToUser(entity));
    } catch (err) { console.warn('Case-insensitive email filter not supported, falling back to scan:', (err as Error)?.message); }

    for await (const entity of client.listEntities()) {
      if (entity.email && String(entity.email).toLowerCase() === email.toLowerCase()) return c.json(entityToUser(entity));
    }

    return c.json({ error: 'User not found' }, 404);
  } catch (error) {
    console.error('Error retrieving user by email:', error);
    return c.json({ error: 'Failed to retrieve user by email', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

usersRouter.get('/:userId/memberships', async (c) => {
  try {
    const userId = c.req.param('userId');
    const client = await getTableClient(MEMBERSHIPS_TABLE);
    const escapedUserId = escapeODataValue(userId);
    const entities = client.listEntities({ queryOptions: { filter: `userId eq '${escapedUserId}'` } });
    const memberships = [];
    for await (const entity of entities) memberships.push(entityToMembership(entity));
    console.log(`Retrieved ${memberships.length} memberships for user: ${userId}`);
    return c.json(memberships);
  } catch (error) {
    console.error('Error retrieving user memberships:', error);
    return c.json({ error: 'Failed to retrieve user memberships', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

usersRouter.put('/', async (c) => {
  try {
    const user = await c.req.json() as any;
    if (!user.id || !user.email || !user.name) return c.json({ error: 'Missing required fields: id, email, name' }, 400);
    const client = await getTableClient(USERS_TABLE);
    try {
      await client.getEntity(user.id, user.id);
      const entity = userToEntity(user);
      await client.updateEntity(entity, 'Merge');
      console.log(`Updated user: ${user.id} (${user.email})`);
      return c.json(entityToUser(entity));
    } catch (error: any) {
      if (error.statusCode === 404) {
        const entity = userToEntity(user);
        await client.createEntity(entity);
        console.log(`Created user: ${user.id} (${user.email})`);
        return c.json(entityToUser(entity), 201);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error saving user:', error);
    return c.json({ error: 'Failed to save user', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

usersRouter.get('/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const client = await getTableClient(USERS_TABLE);
    const entity = await client.getEntity(userId, userId);
    return c.json(entityToUser(entity));
  } catch (error: any) {
    console.error('Error retrieving user:', error);
    if (error.statusCode === 404) return c.json({ error: 'User not found' }, 404);
    return c.json({ error: 'Failed to retrieve user', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

usersRouter.patch('/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const updates = await c.req.json() as any;
    const client = await getTableClient(USERS_TABLE);
    const existingEntity = await client.getEntity(userId, userId);
    const existingUser = entityToUser(existingEntity);
    const updatedUser = {
      ...existingUser,
      name: updates.name !== undefined ? updates.name : existingUser.name,
      profilePicture: updates.profilePicture !== undefined ? updates.profilePicture : existingUser.profilePicture,
      lastLoginAt: updates.lastLoginAt !== undefined ? updates.lastLoginAt : existingUser.lastLoginAt,
      brigadeId: updates.brigadeId !== undefined ? updates.brigadeId : existingUser.brigadeId,
    };
    await client.updateEntity(userToEntity(updatedUser), 'Merge');
    console.log(`Updated user: ${userId}`);
    return c.json(updatedUser);
  } catch (error: any) {
    console.error('Error updating user:', error);
    if (error.statusCode === 404) return c.json({ error: 'User not found' }, 404);
    return c.json({ error: 'Failed to update user', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
