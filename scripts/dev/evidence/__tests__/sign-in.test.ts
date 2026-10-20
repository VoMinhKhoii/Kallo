import { describe, expect, it } from 'vitest';
import { accountExists, signInEnv } from '../sign-in.mjs';

function pages(...emailPages: (string | null)[][]) {
  const calls: number[] = [];
  const listUsers = async ({ page }: { page: number }) => {
    calls.push(page);
    const emails = emailPages[page - 1] ?? [];
    return { data: { users: emails.map((email) => ({ email })) }, error: null };
  };
  return { listUsers, calls };
}

describe('accountExists', () => {
  it('finds the account case-insensitively on the first page', async () => {
    const { listUsers, calls } = pages(['a@x.fit', 'Demo@Kallo.fit']);
    expect(await accountExists(listUsers, 'demo@kallo.fit')).toBe(true);
    expect(calls).toEqual([1]);
  });

  it('pages on while pages come back full', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => `u${i}@x.fit`);
    const { listUsers, calls } = pages(full, [null, 'demo@kallo.fit']);
    expect(await accountExists(listUsers, 'demo@kallo.fit')).toBe(true);
    expect(calls).toEqual([1, 2]);
  });

  it('answers false after the last page instead of creating anything', async () => {
    const { listUsers, calls } = pages(['a@x.fit']);
    expect(await accountExists(listUsers, 'typo@kallo.fit')).toBe(false);
    expect(calls).toEqual([1]);
  });

  it('fails when the accounts cannot be listed', async () => {
    const listUsers = async () => ({
      data: { users: [] },
      error: { message: 'forbidden' },
    });
    await expect(accountExists(listUsers, 'demo@kallo.fit')).rejects.toThrow(
      'Could not list accounts: forbidden'
    );
  });
});

describe('signInEnv', () => {
  it('names every missing variable', () => {
    expect(() => signInEnv({})).toThrow(
      'Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EVIDENCE_ACCOUNT_EMAIL'
    );
  });
});
