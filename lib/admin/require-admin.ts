import 'server-only';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface AdminUser {
  id: string;
  email: string;
}

function adminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  const email = user?.email?.toLowerCase();
  if (!user || !email) notFound();
  const allow = adminEmails();
  if (allow.size === 0) notFound();
  if (!allow.has(email)) notFound();
  return { id: user.id, email };
}
