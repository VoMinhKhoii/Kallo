import { UtensilsCrossed } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '~/theme/text';
import { colors, radii, space } from '~/theme/tokens';

// Hardcoded Vietnamese suggestions (matches web — these are not localized).
const SUGGESTIONS = ['2 mực kho + cơm', 'Phở bò tái', 'Bún chả Hà Nội'];

export function EmptyState({
  onSuggestion,
}: {
  onSuggestion: (suggestion: string) => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconTile}>
        <UtensilsCrossed color={colors.accent} size={26} />
      </View>
      <Text variant="h4">What did you eat?</Text>
      <Text variant="small" style={styles.subtitle}>
        Describe your meal and get a macro breakdown.
      </Text>
      <View style={styles.chips}>
        {SUGGESTIONS.map((s) => (
          <Pressable
            key={s}
            style={styles.chip}
            onPress={() => onSuggestion(s)}
          >
            <Text variant="small" style={{ color: colors.text }}>
              {s}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: space[12], gap: space[3] },
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: radii['2xl'],
    backgroundColor: colors.hover,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[1],
  },
  subtitle: { textAlign: 'center', maxWidth: 280 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space[2],
    marginTop: space[2],
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    backgroundColor: colors.elev,
  },
});
