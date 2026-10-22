'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { CustomSelect } from '@/components/settings/chrome/custom-select';
import { SettingsRow } from '@/components/settings/chrome/group';
import { isThemeChoice, THEME_CHOICES } from '@/lib/core/theme/themes';

const subscribeNever = () => () => {};

/**
 * Settings → Appearance: System, Light, Dark (Graphite) or Aurora. Applies at
 * once and is kept on this device only (next-themes' localStorage), the way
 * the iOS app keeps its own copy.
 */
export function AppearanceRow() {
  const t = useTranslations('settings.appearance');
  const { theme, setTheme } = useTheme();
  // The stored choice exists only in the browser; the server render shows the
  // default so hydration matches, then the real value takes over.
  const isClient = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
  const value = isClient && isThemeChoice(theme) ? theme : 'system';

  return (
    <SettingsRow label={t('label')} description={t('hint')}>
      <div className="w-full sm:w-72">
        <CustomSelect
          options={THEME_CHOICES.map((choice) => ({
            value: choice,
            label: t(choice),
          }))}
          value={value}
          onChange={setTheme}
        />
      </div>
    </SettingsRow>
  );
}
