import { useNavigation } from 'expo-router';
import { Menu } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';
import { useTranslations } from '~/i18n';
import { colors, radii, space } from '~/theme/tokens';

/**
 * In-flow mobile header — ported from the web MobileNav header row: a hamburger
 * button on the left that opens the drawer, a flexible center slot (the logging
 * screen fills it with the timeline date strip, like the web header slot), and
 * a right spacer mirroring the hamburger so the slot stays centered.
 */
export function AppHeader({
  children,
  expanded = false,
}: {
  children?: ReactNode;
  expanded?: boolean;
}) {
  const navigation = useNavigation();
  const t = useTranslations('app.shell');

  // The header morphs (chip pill → full-width strip) via the layout transition
  // — web animates the container width/shape over 0.28s with the same easing.
  const headerLayout = LinearTransition.duration(280)
    .easing(Easing.bezier(0.16, 1, 0.3, 1))
    .reduceMotion(ReduceMotion.System);

  // Expanded (strip) mode hands the full row to the children (the timeline
  // week strip) and drops the hamburger + spacer so the strip isn't squeezed —
  // mirrors the web header's data-strip-mode contract.
  if (expanded) {
    return (
      <Animated.View style={styles.header} layout={headerLayout}>
        <Animated.View
          style={styles.flex}
          entering={FadeIn.duration(150).reduceMotion(ReduceMotion.System)}
        >
          {children}
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={styles.header} layout={headerLayout}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('openMenu')}
        hitSlop={6}
        onPress={() =>
          (navigation as unknown as { openDrawer?: () => void }).openDrawer?.()
        }
        style={styles.menuBtn}
      >
        <Menu size={20} color={colors.text} />
      </Pressable>

      <Animated.View
        style={styles.slot}
        entering={FadeIn.duration(150).reduceMotion(ReduceMotion.System)}
      >
        {children}
      </Animated.View>

      <View style={styles.spacer} />
    </Animated.View>
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
    borderRadius: radii.sm,
  },
  slot: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  spacer: { width: HIT, height: HIT },
});
