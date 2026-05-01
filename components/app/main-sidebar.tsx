'use client';

import { DesktopSidebar, type DesktopSidebarProps } from './desktop-sidebar';
import type { UserMenuUser } from './user-menu';

const FALLBACK_USER: UserMenuUser = { email: null, displayName: null };

/**
 * Back-compat adapter. The historical entry point was `main-sidebar.tsx` and
 * did not require a user prop; the production-ready implementation lives in
 * `desktop-sidebar.tsx`.
 */
export function MainSidebar({
  user = FALLBACK_USER,
  ...props
}: Omit<DesktopSidebarProps, 'user'> & {
  user?: UserMenuUser;
}) {
  return <DesktopSidebar user={user} {...props} />;
}
