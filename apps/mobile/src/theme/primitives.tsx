import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  View,
  type ViewProps,
} from 'react-native';
import {
  SafeAreaView,
  type Edge,
} from 'react-native-safe-area-context';
import { colors, fonts, radii, shadow, space } from '~/theme/tokens';
import { Text } from '~/theme/text';

/** Full-bleed cream screen with safe-area insets. */
export function Screen({
  children,
  style,
  edges = ['top', 'bottom'],
}: {
  children: ReactNode;
  style?: ViewProps['style'];
  edges?: readonly Edge[];
}) {
  return (
    <SafeAreaView style={[s.screen, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

/** White card with a hairline border (hierarchy from borders, not elevation). */
export function Card({ children, style }: { children: ReactNode; style?: ViewProps['style'] }) {
  return <View style={[s.card, style]}>{children}</View>;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: {
  title: string;
  onPress?: PressableProps['onPress'];
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewProps['style'];
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        s.btnBase,
        variant === 'primary' && s.btnPrimary,
        variant === 'secondary' && s.btnSecondary,
        variant === 'danger' && s.btnGhost,
        variant === 'ghost' && s.btnGhost,
        pressed && !isDisabled && s.btnPressed,
        isDisabled && s.btnDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#ffffff' : colors.btn} />
      ) : (
        <Text
          variant="body"
          style={[
            s.btnLabel,
            variant === 'primary' && s.btnLabelPrimary,
            variant === 'danger' && s.btnLabelDanger,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  card: {
    backgroundColor: colors.elev,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii['2xl'],
    padding: space[4],
    ...shadow.xs,
  },
  btnBase: {
    borderRadius: radii.xl,
    paddingVertical: space[4],
    paddingHorizontal: space[5],
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: colors.btn },
  btnSecondary: {
    backgroundColor: colors.elev,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnGhost: { backgroundColor: 'transparent' },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.55 },
  btnLabel: { fontFamily: fonts.sansSemiBold, color: colors.text },
  btnLabelPrimary: { color: '#ffffff' },
  btnLabelDanger: { color: colors.danger },
});
