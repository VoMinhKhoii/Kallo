import { UtensilsCrossed } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
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

  return (
    <View style={styles.wrap}>
      <View style={styles.iconTile}>
        <UtensilsCrossed color={colors.textMuted} size={20} />
      </View>
      <View style={styles.textBlock}>
        <Text variant="h4" style={styles.headline}>
          {t('title')}
        </Text>
        <Text variant="small" style={styles.subtitle}>
          {t('subtitle')}
        </Text>
      </View>
      <View style={styles.chips}>
        {SUGGESTIONS.map((s) => (
          <Pressable
            key={s}
            style={styles.chip}
            onPress={() => onSuggestion(s)}
          >
            <Text variant="chipText">{s}</Text>
          </Pressable>
        ))}
      </View>
    </View>
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
});
