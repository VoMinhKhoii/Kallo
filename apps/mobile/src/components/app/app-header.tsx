import { useNavigation } from 'expo-router';
import { Menu } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslations } from '~/i18n';
import { colors, space } from '~/theme/tokens';

/**
 * In-flow mobile header — ported from the web MobileNav header row: a hamburger
 * button on the left that opens the drawer, a flexible center slot (the logging
 * screen fills it with the timeline date strip, like the web header slot), and
 * a right spacer mirroring the hamburger so the slot stays centered.
 */
export function AppHeader({ children }: { children?: ReactNode }) {
  const navigation = useNavigation();
  const t = useTranslations('app.shell');

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('openMenu')}
        hitSlop={6}
        onPress={() =>
          (navigation as unknown as { openDrawer?: () => void }).openDrawer?.()
        }
        style={styles.menuBtn}
      >
        <Menu size={22} color={colors.text} />
      </Pressable>

      <View style={styles.slot}>{children}</View>

      <View style={styles.spacer} />
    </View>
  );
}

const HIT = 44;
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginBottom: space[1],
  },
  menuBtn: {
    width: HIT,
    height: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  slot: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  spacer: { width: HIT, height: HIT },
});
