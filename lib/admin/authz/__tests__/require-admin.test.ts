import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { getUser } = vi.hoisted(() => ({
  getUser: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser } }),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import { requireAdmin } from '@/lib/admin/authz/require-admin';

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.resetModules();
    getUser.mockReset();
    delete process.env.ADMIN_EMAILS;
  });

  it('returns the user when email is in allowlist (case-insensitive, trimmed)', async () => {
    process.env.ADMIN_EMAILS = ' Admin@Example.com , other@x.com ';
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'admin@example.com' } },
      error: null,
    });
    const u = await requireAdmin();
    expect(u.email).toBe('admin@example.com');
  });

  it('notFound when no session', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com';
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireAdmin()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('notFound when env is empty', async () => {
    process.env.ADMIN_EMAILS = '';
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'admin@example.com' } },
      error: null,
    });
    await expect(requireAdmin()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('notFound when env is missing', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'admin@example.com' } },
      error: null,
    });
    await expect(requireAdmin()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('notFound when email not in allowlist', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com';
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'someone@else.com' } },
      error: null,
    });
    await expect(requireAdmin()).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
