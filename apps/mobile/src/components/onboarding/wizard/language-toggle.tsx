import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import type { AppLocale } from '~/i18n';
import { Text } from '~/theme/text';
import { colors, fonts, radii, space } from '~/theme/tokens';

interface LanguageToggleProps {
  value: AppLocale;
  onChange: (locale: AppLocale) => void;
}

// Web shows GB/VN flag icons (country-flag-icons); that package isn't a mobile
// dep, so the toggle shows the language label + check (no emoji, per design).
const LANGUAGES: { code: AppLocale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Tiếng Việt' },
];

/** RN port of web `components/onboarding/language-toggle.tsx`. */
export function LanguageToggle({ value, onChange }: LanguageToggleProps) {
  return (
    <View style={styles.grid}>
      {LANGUAGES.map(({ code, label }) => {
        const selected = value === code;
        return (
          <Pressable
            key={code}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(code)}
            style={({ pressed }) => [
              styles.btn,
              selected && styles.btnSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text numberOfLines={1} style={styles.label}>
              {label}
            </Text>
            {selected ? (
              <Check size={16} color={colors.accent} style={styles.check} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: space[3] },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderRadius: radii.containerLg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.cream,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  btnSelected: { borderColor: colors.accent, backgroundColor: colors.accent10 },
  pressed: { opacity: 0.85 },
  label: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.text },
  check: { marginLeft: 'auto' },
});
