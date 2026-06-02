import { Globe, Languages, MapPin } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CountrySelect } from '~/components/settings/controls/country-select';
import { type AppLocale, useTranslations } from '~/i18n';
import type { StepOneData } from '~/lib/onboarding/logic/step-one-defaults';
import { Text } from '~/theme/text';
import { colors, fonts, space } from '~/theme/tokens';
import { LanguageToggle } from '~/components/onboarding/wizard/language-toggle';

interface ScreenOriginProps {
  defaultValues: StepOneData;
  onChange: (data: StepOneData) => void;
}

/**
 * RN port of web `components/onboarding/screen-origin.tsx`. No Zod validation;
 * reports on mount so Next is enabled immediately. The web's mid-wizard
 * locale-switch (navigation remount) is dropped — the toggle sets the persisted
 * `preferredLocale` without live-switching the app language (no in-app switcher
 * yet); the device locale governs display.
 */
export function ScreenOrigin({ defaultValues, onChange }: ScreenOriginProps) {
  const t = useTranslations('onboarding.origin');
  const [origin, setOrigin] = useState<string | null>(
    defaultValues.countryOfOrigin
  );
  const [residence, setResidence] = useState<string | null>(
    defaultValues.countryOfResidence
  );
  const [locale, setLocale] = useState<AppLocale>(defaultValues.preferredLocale);
  const hasReported = useRef(false);

  const report = useCallback(
    (o: string | null, r: string | null, l: AppLocale) => {
      onChange({ countryOfOrigin: o, countryOfResidence: r, preferredLocale: l });
    },
    [onChange]
  );

  useEffect(() => {
    if (!hasReported.current) {
      report(origin, residence, locale);
      hasReported.current = true;
    }
  }, [origin, residence, locale, report]);

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('title')}</Text>
        <Text style={styles.subtitle}>{t('subtitle')}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.labelRow}>
          <Languages size={16} color={colors.accent} />
          <Text style={styles.cardLabel}>{t('preferredLanguage')}</Text>
        </View>
        <LanguageToggle
          value={locale}
          onChange={(v) => {
            setLocale(v);
            report(origin, residence, v);
          }}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Globe size={16} color={colors.accent} />
            <Text style={styles.cardLabel}>{t('countryOfOrigin')}</Text>
          </View>
          <Text style={styles.hint}>{t('countryOfOriginHint')}</Text>
          <CountrySelect
            value={origin}
            onChange={(v) => {
              setOrigin(v);
              report(v, residence, locale);
            }}
          />
        </View>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <MapPin size={16} color={colors.accent} />
            <Text style={styles.cardLabel}>{t('countryOfResidence')}</Text>
          </View>
          <Text style={styles.hint}>{t('countryOfResidenceHint')}</Text>
          <CountrySelect
            value={residence}
            onChange={(v) => {
              setResidence(v);
              report(origin, v, locale);
            }}
          />
        </View>

        <Text style={styles.fallbackNote}>{t('fallbackNote')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[6] },
  head: { gap: space[1] },
  title: {
    fontFamily: fonts.serifMedium,
    fontSize: 24,
    letterSpacing: -0.3,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textHelp,
  },
  card: {
    gap: space[4],
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.elev,
    padding: space[5],
  },
  field: { gap: space[2] },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  cardLabel: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.text },
  hint: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textHelp,
  },
  fallbackNote: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textHelp,
  },
});
