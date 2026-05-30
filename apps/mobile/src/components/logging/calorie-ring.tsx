import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '~/theme/text';
import { colors } from '~/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const VIEWBOX = 100;
const RADIUS = 46;
const CENTER = 50;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The calorie ring shows REMAINING calories as the fill fraction (matches web's
 * shared/calorie-ring). The progress arc animates its strokeDashoffset.
 *
 * `center` overrides the default in-ring content (the remaining number + "left"
 * eyebrow) with a custom node — the dashboard TodayDock passes a <Flame/> here,
 * mirroring the web's `center` prop, because the remaining figure is already
 * shown as the hero number above the ring.
 */
export function CalorieRing({
  current,
  target,
  size = 78,
  strokeWidth = 3,
  center,
}: {
  current: number;
  target: number;
  size?: number;
  strokeWidth?: number;
  center?: ReactNode;
}) {
  const remaining = Math.max(0, target - current);
  const pct = target > 0 ? Math.min(remaining / target, 1) : 0;
  const offset = useSharedValue(CIRCUMFERENCE);

  useEffect(() => {
    offset.value = withTiming(CIRCUMFERENCE * (1 - pct), {
      duration: 1000,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      reduceMotion: ReduceMotion.System,
    });
  }, [pct, offset]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        style={{ position: 'absolute' }}
      >
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke={colors.track}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
          fill="none"
        />
        <AnimatedCircle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke={colors.accent}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
        />
      </Svg>
      {center ?? (
        <>
          <Text
            variant="numDisplay"
            style={{ fontSize: 17, lineHeight: 17, letterSpacing: 0 }}
          >
            {remaining.toLocaleString()}
          </Text>
          <Text
            variant="eyebrow"
            style={{ fontSize: 8, letterSpacing: 1.2, marginTop: 2 }}
          >
            left
          </Text>
        </>
      )}
    </View>
  );
}
