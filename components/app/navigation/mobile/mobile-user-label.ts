import type { UserMenuUser } from '../user-menu';

export function deriveInitial(user: UserMenuUser): string {
  const source = user.displayName || user.email || '';
  const trimmed = source.trim();
  if (!trimmed) return '·';
  return trimmed.charAt(0).toUpperCase();
}

export function deriveLabel(user: UserMenuUser): string {
  if (user.displayName?.trim()) return user.displayName.trim();
  if (user.email) return user.email.split('@')[0] ?? user.email;
  return '';
}
