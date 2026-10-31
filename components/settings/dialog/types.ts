import type { ReactNode } from 'react';
import type { SettingsPageId } from '@/lib/domain/settings/pages';
import type { ProfileInput } from '@/lib/domain/settings/profile-form';

/** The profile row as the dialog reads it, or null before onboarding. */
export type SettingsProfile = ProfileInput & { autoShareToCircle: boolean };

export interface SettingsAccount {
  userId: string;
  email: string | null;
}

/** What both layouts (desktop rail, phone sheet) need from the frame. */
export interface SettingsLayoutProps {
  /** The page in the URL, or null when it names none (or a hidden one). */
  page: SettingsPageId | null;
  onShow: (page: SettingsPageId | null) => void;
  isVisible: (page: SettingsPageId) => boolean;
  renderPage: (page: SettingsPageId) => ReactNode;
  /** The profile form's save bar; absent before onboarding. */
  saveBar: ReactNode;
}
