import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Reanimated, {
  FadeInDown,
  FadeInLeft,
  FadeOut,
  ReduceMotion,
} from 'react-native-reanimated';
import type { StreamStatus } from '@/lib/ai/streaming/types';
import type { MealItem } from '@/lib/types/meal';
import { useTranslations } from '~/i18n';
import { fmtG, fmtKcal } from '~/lib/logging/logic/format';
import { Card } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { colors, fonts, fontSize, radii, space } from '~/theme/tokens';

const PHASE_KEYS = new Set([
  'connecting',
  'decomposing',
  'matching',
  'estimating',
  'assembling',
]);

/** A continuously-rotating 12px tan ring (CSS `animate-spin` equivalent). */
function Spinner() {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />;
}

/** A pulsing opacity (0.5 → 1) loop for the timeline dot / skeleton bars. */
function usePulse() {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.5,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return pulse;
}

/** Live preview while the SSE analysis streams: completed items, then names
 * still awaiting macros (the waterfall). */
export function StreamingEntry({
  status,
  items,
  completedItems,
}: {
  status: StreamStatus;
  items: string[];
  completedItems: MealItem[];
}) {
  const t = useTranslations('logging.streaming');
  const tMealEntry = useTranslations('logging.mealEntry');
  const completedNames = new Set(completedItems.map((i) => i.name.toLowerCase()));
  const pendingNames = items.filter((n) => !completedNames.has(n.toLowerCase()));
  const pulse = usePulse();
  const phaseLabel = PHASE_KEYS.has(status) ? t(status) : t('analyzing');

  return (
    // Web streaming card enters opacity+y:10, exits opacity, 0.2s.
    <Reanimated.View
      entering={FadeInDown.duration(200).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(200).reduceMotion(ReduceMotion.System)}
    >
      <Card style={styles.card}>
        {/* Left timeline rail — active-streaming affordance. */}
        <View style={styles.railLine} pointerEvents="none" />
        <Animated.View style={[styles.railDot, { opacity: pulse }]} pointerEvents="none" />

        {/* Items block — web wraps rows in mb-4 space-y-1 (16px below, 4px between). */}
        <View style={styles.itemsBlock}>
          {completedItems.map((item, index) => (
            // Each completed item waterfalls in from the left (web stagger
            // index*0.04s).
            <Reanimated.View
              key={item.id}
              style={styles.row}
              entering={FadeInLeft.duration(250)
                .delay(index * 40)
                .reduceMotion(ReduceMotion.System)}
            >
              <Text variant="itemName" style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.rowRight}>
                <View style={styles.macroGroup}>
                  <Text variant="macroTiny">{`P: ${fmtG(item.macros.protein)}`}</Text>
                  <Text variant="macroTiny">{`C: ${fmtG(item.macros.carbs)}`}</Text>
                  <Text variant="macroTiny">{`F: ${fmtG(item.macros.fat)}`}</Text>
                </View>
                <Text variant="calorieBold">{fmtKcal(item.macros.calories)}</Text>
              </View>
            </Reanimated.View>
          ))}

          {pendingNames.map((name, index) => (
            // Pending skeleton rows stagger in too (web skeleton index*0.08s).
            <Reanimated.View
              key={`${name}-${index}`}
              style={styles.row}
              entering={FadeInLeft.duration(250)
                .delay(index * 80)
                .reduceMotion(ReduceMotion.System)}
            >
              <Text variant="itemName" style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              <View style={styles.rowRight}>
                <View style={styles.macroGroup}>
                  <Animated.View style={[styles.skelBarSm, { opacity: pulse }]} />
                  <Animated.View style={[styles.skelBarSm, { opacity: pulse }]} />
                  <Animated.View style={[styles.skelBarSm, { opacity: pulse }]} />
                </View>
                <Animated.View style={[styles.skelBarKcalSm, { opacity: pulse }]} />
              </View>
            </Reanimated.View>
          ))}
        </View>

        {/* Totals skeleton — dashed-top 'Total' row with macro + calorie bars. */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{tMealEntry('total')}</Text>
          <View style={styles.totalRight}>
            <View style={styles.totalMacroGroup}>
              <Animated.View style={[styles.skelBarTotal, { opacity: pulse }]} />
              <Animated.View style={[styles.skelBarTotal, { opacity: pulse }]} />
              <Animated.View style={[styles.skelBarTotal, { opacity: pulse }]} />
            </View>
            <Animated.View style={[styles.skelBarKcalTotal, { opacity: pulse }]} />
          </View>
        </View>

        {/* Stage indicator — spinner + phase label, at the bottom of the card. */}
        <View style={styles.stage}>
          <Spinner />
          <Text variant="phaseLabel">{phaseLabel}</Text>
        </View>
      </Card>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: space[3],
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
  },
  railLine: {
    position: 'absolute',
    width: 1,
    top: 8,
    bottom: 0,
    left: 4,
    backgroundColor: colors.borderSoft,
  },
  railDot: {
    position: 'absolute',
    top: 8,
    left: 1,
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.timelineDotFill,
  },
  // Items block: 4px between rows (web space-y-1), 16px before totals (mb-4).
  itemsBlock: { gap: space[1], marginBottom: space[4] },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  name: { flex: 1 },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    flexShrink: 0,
  },
  macroGroup: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  totalMacroGroup: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: colors.borderHalf,
    paddingTop: space[3],
  },
  totalLabel: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize['13'],
    color: colors.text,
  },
  totalRight: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  // Skeleton bars share the pulse animation; sizes match the web treatment.
  skelBarSm: {
    width: 12,
    height: 24,
    borderRadius: radii.sm,
    backgroundColor: colors.borderFaint,
  },
  skelBarKcalSm: {
    width: 14,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.borderBiscotti40,
  },
  skelBarTotal: {
    width: 12,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.borderFaint,
  },
  skelBarKcalTotal: {
    width: 16,
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.borderBiscotti40,
  },
  stage: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[3] },
  spinner: {
    width: 12,
    height: 12,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderTopColor: 'transparent',
  },
});
