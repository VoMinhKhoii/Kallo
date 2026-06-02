import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { NutrientCardData } from '@/lib/nutrition/types';
import { useTranslations } from '~/i18n';
import { shouldShowExceed } from '~/lib/nutrition/logic/helpers';
import { STATUS_COLORS, statusKeyFor } from '~/lib/nutrition/logic/status';
import { Text } from '~/theme/text';
import { colors, fonts, space } from '~/theme/tokens';
import { NutrientDetail } from './nutrient-detail';

interface NutrientRowProps {
  card: NutrientCardData;
}

/** RN port of web `components/nutrition/rows/nutrient-row.tsx` (expandable). */
export function NutrientRow({ card }: NutrientRowProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const [open, setOpen] = useState(false);
  const rotate = useSharedValue(0);

  const label = tRoot(card.labelKey);
  const isLimited =
    card.displayState === 'limited_data' ||
    card.displayState === 'insufficient_data';
  const hasNoTarget = card.percentOfTarget === null;
  const dotColor =
    isLimited || hasNoTarget
      ? colors.stone
      : STATUS_COLORS[statusKeyFor(card)];

  const showExceed = shouldShowExceed(card.nutrientType, card.percentOfTarget);

  let figure: string;
  if (card.displayState === 'insufficient_data') {
    figure = t('steady.limited');
  } else if (card.percentOfTarget === null) {
    figure = t('steady.noTarget');
  } else if (showExceed && card.percentOfTarget > 100) {
    figure = `+${Math.round(card.percentOfTarget - 100)}%`;
  } else {
    figure = t('steady.percent', { value: Math.round(card.percentOfTarget) });
  }

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  const toggle = () => {
    const next = !open;
    setOpen(next);
    rotate.value = withTiming(next ? 90 : 0, {
      duration: 200,
      reduceMotion: ReduceMotion.System,
    });
  };

  return (
    // layout transition reflows the list smoothly as the detail mounts/unmounts.
    <Animated.View
      layout={LinearTransition.duration(280).reduceMotion(ReduceMotion.System)}
      style={styles.row}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text numberOfLines={1} style={styles.label}>
          {label}
        </Text>
        <Text
          style={[
            styles.figure,
            showExceed
              ? styles.figureExceed
              : isLimited
                ? styles.figureMuted
                : styles.figureText,
          ]}
        >
          {figure}
        </Text>
        <Animated.View style={chevronStyle}>
          <ChevronRight size={16} color={colors.stone} />
        </Animated.View>
      </Pressable>

      {open ? (
        // Web height/opacity collapse, duration 0.28.
        <Animated.View
          entering={FadeIn.duration(280).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(280).reduceMotion(ReduceMotion.System)}
          style={styles.detail}
        >
          <NutrientDetail card={card} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: 1, borderColor: colors.borderBiscotti40 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  buttonPressed: { backgroundColor: colors.hover40 },
  dot: { width: 6, height: 6, borderRadius: 9999 },
  label: { flex: 1, fontFamily: fonts.sansRegular, fontSize: 14, color: colors.text },
  figure: { fontSize: 12, fontVariant: ['tabular-nums'] },
  figureText: { fontFamily: fonts.sansRegular, color: colors.text },
  figureMuted: { fontFamily: fonts.sansRegular, color: colors.textMuted },
  figureExceed: { fontFamily: fonts.sansRegular, color: colors.danger },
  detail: { paddingHorizontal: space[4], paddingBottom: space[4] },
});
