import { db } from '@template/libs';
import { users, type NewUser, type User } from '@template/contracts';
import { eq } from 'drizzle-orm';

export async function createUserInDb(userData: NewUser): Promise<User> {
  const [user] = await db.insert(users).values(userData).returning();
  if (!user) throw new Error('Failed to create user');
  return user;
}

export async function getUserById(userId: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user;
}

export async function updateUserInDb(
  userId: string,
  data: {
    firstName?: string | undefined;
    lastName?: string | undefined;
    status?: string | undefined;
  }
): Promise<User | undefined> {
  // Filter out undefined values to work with exactOptionalPropertyTypes
  const updateData = Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined)
  ) as Partial<NewUser>;

  const [user] = await db
    .update(users)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return user;
}
