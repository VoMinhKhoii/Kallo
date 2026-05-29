import { Drawer } from 'expo-router/drawer';
import { Sidebar } from '~/components/app/sidebar';
import { colors } from '~/theme/tokens';

/**
 * Primary navigation — a left slide-in Drawer with a custom Sidebar, opened by
 * the hamburger in AppHeader. Mirrors the web's mobile nav (a hamburger header
 * + sheet drawer), replacing the earlier bottom tab bar.
 */
export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={(props) => <Sidebar {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        swipeEdgeWidth: 48,
        drawerStyle: { backgroundColor: colors.surface, width: 320 },
      }}
    >
      <Drawer.Screen name="logging" />
      <Drawer.Screen name="dashboard" />
      <Drawer.Screen name="nutrition" />
      <Drawer.Screen name="settings" />
    </Drawer>
  );
}
