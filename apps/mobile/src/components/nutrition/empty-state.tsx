import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslations } from '~/i18n';
import { Text } from '~/theme/text';
import { colors, fonts, radii, space } from '~/theme/tokens';

/** RN port of web `components/nutrition/states/empty-state.tsx`. */
export function EmptyState() {
  const t = useTranslations('nutrition');
  const router = useRouter();

  return (
    <View style={styles.section}>
      <SeedMark />
      <View style={styles.copy}>
        <Text style={styles.heading}>{t('emptyV2.title')}</Text>
        <Text style={styles.body}>{t('emptyV2.description')}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/logging')}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      >
        <Text style={styles.ctaLabel}>{t('emptyV2.logMeal')}</Text>
      </Pressable>
    </View>
  );
}

function SeedMark() {
  return (
    <Svg width={56} height={56} viewBox="0 0 56 56" fill="none">
      <Path
        d="M28 8c8 6 12 14 12 22 0 10-7 18-12 18s-12-8-12-18c0-8 4-16 12-22z"
        stroke={colors.accent}
        strokeWidth={1.25}
        strokeLinejoin="round"
        opacity={0.55}
      />
      <Path
        d="M28 16c0 8 0 18 0 30"
        stroke={colors.accent}
        strokeWidth={1}
        strokeLinecap="round"
        opacity={0.45}
        strokeDasharray="2 3"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  section: { alignItems: 'flex-start', gap: space[6], paddingVertical: space[10] },
  copy: { gap: space[3] },
  heading: {
    fontFamily: fonts.serifMedium,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.36,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textMuted,
  },
  cta: {
    borderRadius: radii.pill,
    backgroundColor: colors.text,
    paddingHorizontal: space[5],
    paddingVertical: 10,
  },
  ctaPressed: { opacity: 0.9 },
  ctaLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.surface,
  },
});
