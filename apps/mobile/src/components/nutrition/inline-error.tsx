import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '~/theme/text';
import { colors, radii, space } from '~/theme/tokens';

interface InlineErrorProps {
  isRetrying: boolean;
  message: string;
  onRetry: () => void;
  retryLabel: string;
}

/** RN port of web `components/nutrition/states/inline-error.tsx`. */
export function InlineError({
  isRetrying,
  message,
  onRetry,
  retryLabel,
}: InlineErrorProps) {
  return (
    <View accessibilityRole="alert" style={styles.card}>
      <Text variant="body">{message}</Text>
      <Pressable
        onPress={onRetry}
        disabled={isRetrying}
        accessibilityRole="button"
        accessibilityState={{ disabled: isRetrying, busy: isRetrying }}
        style={({ pressed }) => [
          styles.btn,
          pressed && !isRetrying && styles.btnPressed,
          isRetrying && styles.btnDisabled,
        ]}
      >
        <Text variant="small" style={styles.btnLabel}>
          {retryLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.elev,
    padding: space[4],
    gap: space[3],
  },
  btn: {
    alignSelf: 'flex-start',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  btnPressed: { backgroundColor: colors.hover },
  btnDisabled: { opacity: 0.5 },
  btnLabel: { color: colors.text, fontWeight: '500' },
});
