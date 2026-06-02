import { StyleSheet, View } from 'react-native';
import { useTranslations } from '~/i18n';
import { colors, radii, space } from '~/theme/tokens';

/**
 * Single-column loading skeleton mirroring the mobile editorial stack:
 * header → calorie card + macro rows → steady list → background toggle →
 * pull-quote. RN port of web `components/nutrition/nutrition-skeleton.tsx`
 * (the lg:two-up grid collapses to one column on phone).
 */
export function NutritionSkeleton() {
  const t = useTranslations('nutrition');

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('loading')}
      style={styles.stack}
    >
      {/* Editorial header */}
      <View style={styles.headerBlock}>
        <Bar w={128} />
        <Bar w={176} />
      </View>

      {/* Daily rhythm card */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Bar w={128} h={40} />
          <Bar w={120} h={8} />
        </View>
        <View style={styles.macroRows}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.macroRow}>
              <Bar w={64} />
              <View style={styles.flex}>
                <Bar h={4} />
              </View>
              <Bar w={44} />
            </View>
          ))}
        </View>
      </View>

      {/* Steady list */}
      <View style={styles.listCard}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.listRow}>
            <View style={styles.dot} />
            <View style={styles.flex}>
              <Bar h={12} />
            </View>
            <Bar w={44} />
          </View>
        ))}
      </View>

      {/* Background toggle */}
      <View style={styles.rowBetween}>
        <Bar w={128} />
        <Bar w={80} />
      </View>

      {/* Pull-quote */}
      <View style={styles.pullQuote}>
        <Bar w={96} />
        <Bar w="100%" />
        <Bar w="80%" />
      </View>
    </View>
  );
}

function Bar({
  w,
  h = 12,
}: {
  w?: number | `${number}%`;
  h?: number;
}) {
  return (
    <View
      style={{
        width: w ?? '100%',
        height: h,
        borderRadius: radii.pill,
        backgroundColor: colors.track,
      }}
    />
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[12] },
  flex: { flex: 1 },
  headerBlock: {
    gap: space[2],
    borderBottomWidth: 1,
    borderColor: colors.borderHalf,
    paddingBottom: space[5],
  },
  card: {
    // Web rounded-3xl = 24 (matches the live daily-rhythm card).
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: space[5],
    gap: space[5],
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  macroRows: { gap: space[3] },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  listCard: {
    // Web rounded-2xl = 16 (containerLg), matching the live steady list.
    borderRadius: radii.containerLg,
    borderWidth: 1,
    borderColor: colors.borderHalf,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderBottomWidth: 1,
    borderColor: colors.borderFaint,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  dot: { width: 6, height: 6, borderRadius: radii.pill, backgroundColor: colors.track },
  pullQuote: {
    gap: space[2],
    borderLeftWidth: 3,
    borderStyle: 'dashed',
    borderColor: colors.accent30,
    paddingLeft: space[5],
  },
});
