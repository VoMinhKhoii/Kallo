import {
  CircleUserRound,
  CookingPot,
  CreditCard,
  Gauge,
  KeyRound,
  type LucideIcon,
  MessageSquare,
  Shield,
  SlidersHorizontal,
} from 'lucide-react';
import type { SettingsPageId } from '@/lib/domain/settings/pages';

/** The icon beside each page's name in the rail and the phone menu. */
export const SETTINGS_PAGE_ICONS: Record<SettingsPageId, LucideIcon> = {
  profile: CircleUserRound,
  body: Gauge,
  preferences: SlidersHorizontal,
  cooking: CookingPot,
  privacy: Shield,
  subscriptions: CreditCard,
  account: KeyRound,
  feedback: MessageSquare,
};
