import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '~/theme/text';
import { colors, fonts, radii, shadow, space } from '~/theme/tokens';

interface OptionStripItem {
  value: string;
  label: string;
  hint?: string;
}

interface OptionStripProps {
  options: OptionStripItem[];
  value: string;
  onChange: (value: string) => void;
}

/** RN port of web `components/settings/option-strip.tsx` — segmented control
 *  with equal-width buttons and an optional hint sub-label. */
export function OptionStrip({ options, value, onChange }: OptionStripProps) {
  return (
    <View style={styles.strip}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [
              styles.btn,
              active && styles.btnActive,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.label,
                active ? styles.labelActive : styles.labelInactive,
              ]}
            >
              {opt.label}
            </Text>
            {opt.hint ? (
              <Text
                style={[
                  styles.hint,
                  active ? styles.labelActive : styles.labelInactive,
                ]}
              >
                {opt.hint}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    borderRadius: radii.buttonXl,
    backgroundColor: colors.track,
    padding: space[1],
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radii.md,
    paddingVertical: space[2],
    paddingHorizontal: 4,
  },
  btnActive: { backgroundColor: colors.elev, ...shadow.xs },
  pressed: { opacity: 0.85 },
  label: { fontFamily: fonts.sansMedium, fontSize: 13, textAlign: 'center' },
  hint: {
    marginTop: 2,
    fontFamily: fonts.sansRegular,
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center',
    opacity: 0.7,
  },
  labelActive: { color: colors.text },
  labelInactive: { color: colors.textWarm },
});
