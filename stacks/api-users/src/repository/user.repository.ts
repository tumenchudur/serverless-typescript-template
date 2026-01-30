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

export async function updateUserInDb(userId: string, data: Partial<NewUser>): Promise<User | undefined> {
  const [user] = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return user;
}
