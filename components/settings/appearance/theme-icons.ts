import { type LucideIcon, Monitor, Moon, Sparkles, Sun } from 'lucide-react';
import type { ThemeChoice } from '@/lib/core/theme/themes';

/** One icon per Appearance choice, the same wherever the choice is offered. */
export const THEME_ICONS: Record<ThemeChoice, LucideIcon> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
  aurora: Sparkles,
};
