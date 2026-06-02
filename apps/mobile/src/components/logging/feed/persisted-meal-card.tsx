import { ChevronDown } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { PersistedMeal } from '@/lib/api/contracts/meals';
import { useTranslations } from '~/i18n';
import { fmtG, fmtKcal } from '~/lib/logging/logic/format';
import { Card } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { colors, fontSize, leading, radii, shadow, space } from '~/theme/tokens';

const r = Math.round;

/** A saved meal in the day's feed — collapsed by default, expandable. */
export function PersistedMealCard({ meal }: { meal: PersistedMeal }) {
  const t = useTranslations('logging.persistedMealCard');
  const [collapsed, setCollapsed] = useState(true);
  const n = meal.nutrition;
  const time = new Date(meal.loggedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Chevron rotates 0°↔180° over 200ms (web chevron transition-transform).
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withTiming(collapsed ? 0 : 180, {
      duration: 200,
      reduceMotion: ReduceMotion.System,
    });
  }, [collapsed, rot]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  return (
    // layout lets the card height animate as details expand/collapse (web
    // animates height auto via AnimatePresence — RN reflows the wrapper).
    <Animated.View
      layout={LinearTransition.duration(200).reduceMotion(ReduceMotion.System)}
    >
      <Card style={styles.card}>
        <Text variant="timeLabel" style={styles.time}>
          {time}
        </Text>
        <Pressable style={styles.headerRow} onPress={() => setCollapsed((c) => !c)}>
          <Text variant="mealQuote" style={styles.quote}>
            {meal.rawInput}
          </Text>
          <View
            style={styles.chevronButton}
            accessibilityRole="button"
            accessibilityLabel={t('toggleDetails')}
            accessibilityState={{ expanded: !collapsed }}
          >
            <Animated.View style={chevronStyle}>
              <ChevronDown color={colors.textMuted} size={16} />
            </Animated.View>
          </View>
        </Pressable>

        {/* Collapsed summary ↔ details crossfade (web AnimatePresence). */}
        {collapsed ? (
          <Animated.View
            style={styles.macroRow}
            entering={FadeIn.duration(150).reduceMotion(ReduceMotion.System)}
            exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}
          >
            <Text variant="captionTabular">
              {`P: ${fmtG(n.proteinG)}  C: ${fmtG(n.carbohydrateG)}  F: ${fmtG(n.fatG)}`}
            </Text>
            <Text variant="numStrong" style={styles.summaryCalories}>
              {fmtKcal(n.caloriesKcal)}
            </Text>
          </Animated.View>
        ) : (
          <Animated.View
            style={styles.details}
            entering={FadeInDown.duration(200).reduceMotion(ReduceMotion.System)}
            exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}
          >
          <View style={styles.itemList}>
            {meal.mealItemGroups.map((group) => (
              <View key={`${group.order}-${group.name}`} style={styles.groupRow}>
                <Text
                  variant="itemName"
                  style={styles.groupName}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {group.name}
                </Text>
                <View style={styles.groupRight}>
                  <View style={styles.groupMacros}>
                    <Text variant="macroTiny">{`P:${fmtG(group.nutrition.proteinG)}`}</Text>
                    <Text variant="macroTiny">{`C:${fmtG(group.nutrition.carbohydrateG)}`}</Text>
                    <Text variant="macroTiny">{`F:${fmtG(group.nutrition.fatG)}`}</Text>
                  </View>
                  <Text variant="calorieBold">{fmtKcal(group.nutrition.caloriesKcal)}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.totalsRow}>
            <Text variant="calorieBold">{t('total')}</Text>
            <View style={styles.totalsRight}>
              <Text variant="captionTabular">
                {`P: ${fmtG(n.proteinG)}  C: ${fmtG(n.carbohydrateG)}  F: ${fmtG(n.fatG)}`}
              </Text>
              <Text variant="numStrong">{fmtKcal(n.caloriesKcal)}</Text>
            </View>
          </View>
          </Animated.View>
        )}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: space[3],
    borderRadius: radii.containerLg,
    borderColor: colors.borderSoft,
    ...shadow.sm,
  },
  time: { marginBottom: space[2] },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[2],
  },
  quote: {
    flex: 1,
    fontSize: 17,
    lineHeight: r(17 * leading.relaxed),
  },
  chevronButton: {
    flexShrink: 0,
    padding: space[1],
    borderRadius: radii.pill,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space[2],
  },
  summaryCalories: { fontSize: fontSize.sm },
  details: {
    marginTop: space[5],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: 'dashed',
    paddingTop: space[4],
  },
  itemList: {
    marginBottom: space[4],
    gap: space[1],
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[2],
  },
  groupName: { flex: 1, minWidth: 0 },
  groupRight: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  groupMacros: {
    flexDirection: 'row',
    gap: space[2],
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.borderHalf,
    borderStyle: 'dashed',
    paddingTop: space[3],
  },
  totalsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
  },
});
