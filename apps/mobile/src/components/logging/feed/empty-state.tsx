import { UtensilsCrossed } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOut,
  ReduceMotion,
  ZoomIn,
} from 'react-native-reanimated';
import { useTranslations } from '~/i18n';
import { Text } from '~/theme/text';
import { colors, radii, space, tracking } from '~/theme/tokens';

// Hardcoded Vietnamese suggestions (matches web — these are not localized).
const SUGGESTIONS = ['2 mực kho + cơm', 'Phở bò tái', 'Bún chả Hà Nội'];

export function EmptyState({
  onSuggestion,
}: {
  onSuggestion: (suggestion: string) => void;
}) {
  const t = useTranslations('logging.emptyState');

  // Web empty-state staggers: container fade, icon scale (delay 0.05), title
  // (0.1), subtitle (0.2), chips (0.3); container exits opacity+y:-10.
  return (
    <Animated.View
      style={styles.wrap}
      exiting={FadeOut.reduceMotion(ReduceMotion.System)}
    >
      <Animated.View
        style={styles.iconTile}
        entering={ZoomIn.duration(300).delay(50).reduceMotion(ReduceMotion.System)}
      >
        <UtensilsCrossed color={colors.textMuted} size={20} />
      </Animated.View>
      <Animated.View style={styles.textBlock}>
        <Animated.View
          entering={FadeInDown.duration(300)
            .delay(100)
            .reduceMotion(ReduceMotion.System)}
        >
          <Text variant="h4" style={styles.headline}>
            {t('title')}
          </Text>
        </Animated.View>
        <Animated.View
          entering={FadeInDown.duration(300)
            .delay(200)
            .reduceMotion(ReduceMotion.System)}
        >
          <Text variant="small" style={styles.subtitle}>
            {t('subtitle')}
          </Text>
        </Animated.View>
      </Animated.View>
      <Animated.View
        style={styles.chips}
        entering={FadeInDown.duration(300).delay(300).reduceMotion(ReduceMotion.System)}
      >
        {SUGGESTIONS.map((s) => (
          <Pressable
            key={s}
            style={({ pressed }) => [
              styles.chip,
              pressed && styles.chipPressed,
            ]}
            onPress={() => onSuggestion(s)}
          >
            <Text variant="chipText">{s}</Text>
          </Pressable>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: space[10], gap: space[4] },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radii.buttonXl,
    backgroundColor: colors.borderFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { alignItems: 'center', gap: 6 },
  headline: { textAlign: 'center', letterSpacing: tracking.tight },
  subtitle: { textAlign: 'center', maxWidth: 280 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.pill,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    backgroundColor: colors.elevTranslucent,
  },
  // Press feedback mirrors web's hover:border-accent/50 + bg-border/15.
  chipPressed: {
    borderColor: colors.accentSelectedBorder,
    backgroundColor: colors.accent15,
  },
});
