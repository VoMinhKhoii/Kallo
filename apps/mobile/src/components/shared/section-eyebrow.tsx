import { StyleSheet } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { Text } from '~/theme/text';
import { colors } from '~/theme/tokens';

interface SectionEyebrowProps {
  label: string;
  /** Optional secondary label (e.g. range word). Rendered after a middle dot. */
  trailing?: string;
  /** Entrance delay, ms (mirrors the web motion stagger). */
  delay?: number;
}

/**
 * RN port of web `components/nutrition/primitives/section-eyebrow.tsx` —
 * bold 11px stone uppercase, wide tracking, optional `· trailing`, with the
 * web's opacity/y entrance fade (Reanimated, respecting reduce-motion).
 */
export function SectionEyebrow({ label, trailing, delay = 0 }: SectionEyebrowProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(500).delay(delay).reduceMotion(ReduceMotion.System)}
      style={styles.row}
    >
      <Text variant="eyebrow" style={styles.label}>
        {label}
      </Text>
      {trailing ? (
        <>
          <Text variant="eyebrow" style={styles.dot}>
            ·
          </Text>
          <Text variant="eyebrow" style={styles.label}>
            {trailing}
          </Text>
        </>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  // Web: text-[11px] tracking-[0.22em] (~2.42px).
  label: { fontSize: 11, letterSpacing: 2.4, color: colors.stone },
  dot: { fontSize: 11, letterSpacing: 0, color: colors.border, marginHorizontal: 8 },
});
