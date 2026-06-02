import { usePathname, useRouter } from 'expo-router';
import { LogOut, Settings } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslations } from '~/i18n';
import { supabase } from '~/lib/supabase';
import { useSession } from '~/lib/session';
import { Text } from '~/theme/text';
import { colors, fonts, radii, space } from '~/theme/tokens';
import { isActiveRoute, NAV_ITEMS } from '~/components/app/nav-items';

/**
 * Drawer content — the mobile primary nav, ported from the web MobileNav sheet
 * (components/app/mobile-nav.tsx): a user header, the nav items, and a footer
 * with the account row, Settings, and Sign out. Opened by the hamburger in
 * AppHeader. Copy via ~/i18n (app.mainSidebar / app.userMenu), same keys as web.
 */
/** Only the bits of the drawer content props the sidebar uses (the two libs'
 * full DrawerContentComponentProps types are nominally incompatible). */
interface SidebarProps {
  navigation: { closeDrawer: () => void };
}

export function Sidebar({ navigation }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const tNav = useTranslations('app.mainSidebar');
  const tMenu = useTranslations('app.userMenu');

  const email = session?.user.email ?? null;
  const label = email ? (email.split('@')[0] ?? email) : tMenu('account');
  const initial = (label || '·').charAt(0).toUpperCase();
  const settingsActive = isActiveRoute(pathname, '/settings');

  const go = (href: string) => {
    navigation.closeDrawer();
    router.push(href as Parameters<typeof router.push>[0]);
  };

  const signOut = async () => {
    navigation.closeDrawer();
    await supabase.auth.signOut();
    router.replace('/sign-in');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerName} numberOfLines={1}>
          {label}
        </Text>
        {email ? (
          <Text style={styles.headerEmail} numberOfLines={1}>
            {email}
          </Text>
        ) : null}
      </View>

      <ScrollView style={styles.navScroll} contentContainerStyle={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActiveRoute(pathname, item.href);
          return (
            <Pressable
              key={item.id}
              onPress={() => go(item.href)}
              style={({ pressed }) => [
                styles.navItem,
                active && styles.navItemActive,
                // web hover:bg-nham-hover/60 press feedback
                pressed && !active && styles.rowPressed,
              ]}
            >
              <Icon size={20} color={active ? '#ffffff' : colors.text} />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                {tNav(item.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space[3] }]}>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.userMeta}>
            <Text style={styles.userName} numberOfLines={1}>
              {label}
            </Text>
            {email ? (
              <Text style={styles.userEmail} numberOfLines={1}>
                {email}
              </Text>
            ) : null}
          </View>
        </View>

        <Pressable
          onPress={() => go('/settings')}
          style={({ pressed }) => [
            styles.footerItem,
            settingsActive && styles.navItemActive,
            pressed && !settingsActive && styles.rowPressed,
          ]}
        >
          <Settings size={16} color={settingsActive ? '#ffffff' : colors.text} />
          <Text style={[styles.footerLabel, settingsActive && styles.navLabelActive]}>
            {tNav('settings')}
          </Text>
        </Pressable>

        <Pressable
          onPress={signOut}
          style={({ pressed }) => [
            styles.footerItem,
            pressed && styles.rowPressed,
          ]}
        >
          <LogOut size={16} color={colors.danger} />
          <Text style={[styles.footerLabel, { color: colors.danger }]}>
            {tMenu('signOut')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    gap: space[1],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    paddingHorizontal: space[4],
    paddingVertical: space[4],
  },
  headerName: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.text },
  headerEmail: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: colors.textMuted },
  navScroll: { flex: 1 },
  nav: { paddingHorizontal: space[3], paddingVertical: space[3], gap: space[1] },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderRadius: radii.md,
    paddingHorizontal: space[3],
    paddingVertical: 10,
  },
  navItemActive: { backgroundColor: colors.btn },
  // web hover:bg-nham-hover/60 — press feedback on nav/footer rows
  rowPressed: { backgroundColor: colors.hover },
  navLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.text },
  navLabelActive: { color: '#ffffff' },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.elevTranslucent,
    paddingHorizontal: space[3],
    paddingTop: space[3],
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderRadius: radii.buttonXl,
    backgroundColor: colors.elev,
    paddingHorizontal: space[3],
    paddingVertical: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSelectedFill,
    borderWidth: 1,
    borderColor: colors.accentSelectedBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.btn },
  userMeta: { flex: 1, minWidth: 0 },
  userName: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text },
  userEmail: { fontFamily: fonts.sansRegular, fontSize: 11, color: colors.textMuted },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderRadius: radii.buttonXl,
    paddingHorizontal: space[3],
    paddingVertical: 10,
    marginTop: space[1],
  },
  footerLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text },
});
