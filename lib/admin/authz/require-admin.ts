import 'server-only';
import { notFound } from 'next/navigation';
import { getAdminEmailSet } from '@/lib/admin/authz/admin-emails';
import { createClient } from '@/lib/infra/supabase/server';

export interface AdminUser {
  id: string;
  email: string;
}

export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  const email = user?.email?.toLowerCase();
  if (!user || !email) notFound();
  const allow = getAdminEmailSet();
  if (allow.size === 0) notFound();
  if (!allow.has(email)) notFound();
  return { id: user.id, email };
}
