'use client';

import { useTranslations } from 'next-intl';
import { CustomSelect } from '@/components/settings/chrome/custom-select';
import { SettingsRow } from '@/components/settings/chrome/group';
import { useThemeChoice } from '@/hooks/theme/use-theme-choice';
import { isThemeChoice, THEME_CHOICES } from '@/lib/core/theme/themes';

/**
 * Settings → Appearance: System, Light, Dark (Graphite) or Aurora. Applies at
 * once and is kept on this device only (localStorage), the way the iOS app
 * keeps its own copy.
 */
export function AppearanceRow() {
  const t = useTranslations('settings.appearance');
  const [choice, setChoice] = useThemeChoice();

  return (
    <SettingsRow label={t('label')} description={t('hint')}>
      <div className="w-full sm:w-72">
        <CustomSelect
          options={THEME_CHOICES.map((option) => ({
            value: option,
            label: t(option),
          }))}
          value={choice}
          onChange={(next) => {
            if (isThemeChoice(next)) setChoice(next);
          }}
        />
      </div>
    </SettingsRow>
  );
}
