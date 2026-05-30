import { useEffect } from 'react';
import { type AccessibilityProps, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { colors, radii } from '~/theme/tokens';

interface TargetProgressBarProps {
  /** Current percent toward target (0..100+); null when no target is set. */
  percentOfTarget: number | null;
  /** Whether to switch to the danger color (e.g. ceiling exceeded). */
  showExceed: boolean;
  /** Fill animation duration, ms (web seconds → ms). */
  duration?: number;
  /** Fill animation delay, ms — staggers the fill after the row enters. */
  delay?: number;
  accessibilityLabel?: string;
}

/**
 * Shared horizontal track — RN port of web `components/nutrition/primitives/
 * target-progress-bar.tsx`. A 1px-ish track with a Reanimated-animated fill
 * (width 0→clamp(pct,0,100)%) and a fixed end-tick marking the 100% target.
 */
export function TargetProgressBar({
  percentOfTarget,
  showExceed,
  duration = 700,
  delay = 0,
  accessibilityLabel,
}: TargetProgressBarProps) {
  const hasValue = percentOfTarget !== null;
  const fillWidth = hasValue ? Math.min(100, Math.max(0, percentOfTarget)) : 0;
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(
      delay,
      withTiming(fillWidth, {
        duration,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [fillWidth, duration, delay, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  const fillColor = !hasValue
    ? colors.stone50
    : showExceed
      ? colors.danger
      : colors.text;

  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={
        hasValue
          ? { min: 0, max: 100, now: Math.round(fillWidth) }
          : undefined
      }
      style={styles.wrap}
    >
      <View style={styles.track} />
      <Animated.View style={[styles.fill, fillStyle, { backgroundColor: fillColor }]} />
      {hasValue ? (
        <View
          style={[
            styles.tick,
            { backgroundColor: showExceed ? colors.danger70 : colors.stone70 },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // h-1 (4px), flex-1. The tick overflows top/bottom, so don't clip.
  wrap: { position: 'relative', height: 4, flex: 1, justifyContent: 'center' },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: radii.pill,
    backgroundColor: colors.track,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radii.pill,
  },
  // Fixed end-tick at the 100% (target) edge — web `top-[-3px] h-[7px] w-px`
  // (top-anchored: extends 3px above the 4px track, flush with the bottom).
  tick: { position: 'absolute', right: 0, top: -3, width: 1, height: 7 },
});

export type { TargetProgressBarProps };
