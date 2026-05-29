import { StyleSheet, View } from 'react-native';
import { Text } from '~/theme/text';
import { colors } from '~/theme/tokens';

interface SectionEyebrowProps {
  label: string;
  /** Optional secondary label (e.g. range word). Rendered after a middle dot. */
  trailing?: string;
}

/**
 * RN port of web `components/nutrition/primitives/section-eyebrow.tsx` —
 * bold 11px stone uppercase with wide tracking, optional `· trailing`.
 */
export function SectionEyebrow({ label, trailing }: SectionEyebrowProps) {
  return (
    <View style={styles.row}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  // Web: text-[11px] tracking-[0.22em]; nudge up from the 10px eyebrow variant.
  label: { fontSize: 11, letterSpacing: 2, color: colors.stone },
  dot: { fontSize: 11, letterSpacing: 0, color: colors.border, marginHorizontal: 8 },
});
