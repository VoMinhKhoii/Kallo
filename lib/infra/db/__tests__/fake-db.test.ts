/**
 * Contract of the shared Drizzle test double (`lib/db/__fixtures__/fake-db.ts`).
 *
 * The fixture is depended on by suites in several modules (waitlist, auth,
 * matching), and a test double that quietly changes its queueing or capture
 * semantics breaks them in ways that look like product bugs. These cases pin
 * the semantics those suites rely on.
 */
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createFakeDb } from '@/lib/infra/db/__fixtures__/fake-db';

describe('createFakeDb', () => {
  it('resolves a select chain to the queued rows, in FIFO order', async () => {
    const fake = createFakeDb();
    fake.queueSelect([{ id: 'first' }]);
    fake.queueSelect([{ id: 'second' }]);

    await expect(fake.db.select().from({} as never)).resolves.toEqual([
      { id: 'first' },
    ]);
    await expect(fake.db.select().from({} as never)).resolves.toEqual([
      { id: 'second' },
    ]);
  });

  it('resolves an unqueued select to no rows', async () => {
    const fake = createFakeDb();
    await expect(fake.db.select().from({} as never)).resolves.toEqual([]);
  });

  it('yields the same rows however far down the chain the await happens', async () => {
    const fake = createFakeDb();
    fake.queueSelect([{ id: 'row' }]);

    const rows = await fake.db
      .select()
      .from({} as never)
      .where({} as never)
      .limit(1);

    expect(rows).toEqual([{ id: 'row' }]);
  });

  it('captures the values passed to insert(...).values(...)', async () => {
    const fake = createFakeDb();
    await fake.db.insert({} as never).values({ email: 'a@b.com' } as never);

    expect(fake.inserts).toEqual([{ email: 'a@b.com' }]);
  });

  it('captures the patch passed to update(...).set(...)', async () => {
    const fake = createFakeDb();
    await fake.db
      .update({} as never)
      .set({ confirmedAt: 'now' } as never)
      .where({} as never);

    expect(fake.updates).toEqual([{ confirmedAt: 'now' }]);
  });

  it('reads an unqueued update as one row changed', async () => {
    const fake = createFakeDb();
    const rows = await fake.db
      .update({} as never)
      .set({} as never)
      .returning();

    expect(rows).toHaveLength(1);
  });

  it('lets a test model a zero-row update — a lost race on a guarded write', async () => {
    const fake = createFakeDb();
    fake.queueUpdate([]);

    const rows = await fake.db
      .update({} as never)
      .set({} as never)
      .returning();

    expect(rows).toEqual([]);
  });

  it('resolves execute to the queued rows, and to none when unqueued', async () => {
    const fake = createFakeDb();
    fake.queueExecute([{ id: 'hit' }]);

    await expect(fake.db.execute(sql`SELECT 1`)).resolves.toEqual([
      { id: 'hit' },
    ]);
    await expect(fake.db.execute(sql`SELECT 1`)).resolves.toEqual([]);
  });

  it('exposes execute as a spy so a suite can assert it was never called', async () => {
    const fake = createFakeDb();
    expect(fake.execute).not.toHaveBeenCalled();

    await fake.db.execute(sql`SELECT 1`);

    expect(fake.execute).toHaveBeenCalledOnce();
  });

  it('counts transactions and hands the callback the same builders', async () => {
    const fake = createFakeDb();
    fake.queueSelect([{ id: 'in-tx' }]);

    const rows = await fake.db.transaction(async (tx) =>
      tx.select().from({} as never)
    );

    expect(rows).toEqual([{ id: 'in-tx' }]);
    expect(fake.transactions()).toBe(1);
  });

  it('keeps writes made inside a transaction in the same capture arrays', async () => {
    const fake = createFakeDb();

    await fake.db.transaction(async (tx) => {
      await tx.insert({} as never).values({ email: 'a@b.com' } as never);
    });

    expect(fake.inserts).toEqual([{ email: 'a@b.com' }]);
  });
});
