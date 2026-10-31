import {
  CircleUserRound,
  CookingPot,
  CreditCard,
  KeyRound,
  type LucideIcon,
  MessageSquare,
  Shield,
  SlidersHorizontal,
  Target,
} from 'lucide-react';
import type { SettingsPageId } from '@/lib/domain/settings/pages';

/** The icon beside each page's name in the rail and the phone menu. */
export const SETTINGS_PAGE_ICONS: Record<SettingsPageId, LucideIcon> = {
  profile: CircleUserRound,
  body: Target,
  preferences: SlidersHorizontal,
  cooking: CookingPot,
  privacy: Shield,
  subscriptions: CreditCard,
  account: KeyRound,
  feedback: MessageSquare,
};
