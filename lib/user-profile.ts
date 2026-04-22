import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';

type Database = typeof db;

async function findUserProfile(userId: string, database: Database) {
  const rows = await database
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getOrCreateUserProfile(
  userId: string,
  database: Database = db
) {
  const existing = await findUserProfile(userId, database);
  if (existing) {
    return existing;
  }

  const inserted = await database
    .insert(userProfiles)
    .values({ userId })
    .onConflictDoNothing({ target: userProfiles.userId })
    .returning();

  if (inserted[0]) {
    return inserted[0];
  }

  const profile = await findUserProfile(userId, database);
  if (profile) {
    return profile;
  }

  throw new Error(`Failed to load or create profile for user ${userId}`);
}
