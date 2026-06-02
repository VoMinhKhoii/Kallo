import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppHeader } from '~/components/app/app-header';
import { Profile } from '~/components/settings/profile';
import { useTranslations } from '~/i18n';
import { useProfile } from '~/lib/onboarding/hooks/use-profile';
import { useSession } from '~/lib/session';
import { Screen } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { colors, fonts, radii, space } from '~/theme/tokens';

/**
 * Settings screen — mobile port of the web `/settings/profile` page. A single
 * profile editor (the web has no account/danger/sign-out here). When the
 * profile row is null, shows the empty state linking to setup.
 */
export default function SettingsScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const router = useRouter();
  const tPage = useTranslations('settings.profilePage');
  const { data: profile, isLoading } = useProfile(!!userId);

  return (
    <Screen edges={['top']}>
      <View style={{ paddingHorizontal: space[3] }}>
        <AppHeader />
      </View>

      {!userId ? (
        <View style={styles.center}>
          <Text variant="small">Not signed in.</Text>
        </View>
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : profile ? (
        <Profile profile={profile} />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{tPage('emptyTitle')}</Text>
          <Text style={styles.emptyDesc}>{tPage('emptyDescription')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/logging')}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaLabel}>{tPage('startSetup')}</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6] },
  empty: {
    flex: 1,
    justifyContent: 'center',
    gap: space[4],
    paddingHorizontal: space[5],
  },
  emptyTitle: {
    fontFamily: fonts.serifMedium,
    fontSize: 24,
    letterSpacing: -0.3,
    color: colors.text,
  },
  emptyDesc: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textWarm,
  },
  cta: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    backgroundColor: colors.text,
    paddingHorizontal: space[5],
    paddingVertical: 10,
  },
  ctaPressed: { opacity: 0.9 },
  ctaLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.cream },
});
