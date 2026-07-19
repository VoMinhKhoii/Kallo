'use client';

import { DesktopSidebar, type DesktopSidebarProps } from './desktop-sidebar';
import type { UserMenuUser } from './user-menu';

const FALLBACK_USER: UserMenuUser = {
  email: null,
  displayName: null,
  avatarUrl: null,
};

/**
 * Back-compat adapter. The historical entry point was `main-sidebar.tsx` and
 * did not require a user prop; the production-ready implementation lives in
 * `desktop-sidebar.tsx`.
 */
export function MainSidebar({
  user,
  userEmail,
  userDisplayName,
  ...props
}: Omit<DesktopSidebarProps, 'user'> & {
  user?: UserMenuUser;
  userEmail?: string | null;
  userDisplayName?: string | null;
}) {
  const effectiveUser = user ?? {
    email: userEmail ?? null,
    displayName: userDisplayName ?? null,
    avatarUrl: null,
  };

  return <DesktopSidebar user={effectiveUser ?? FALLBACK_USER} {...props} />;
}
