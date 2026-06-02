import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { OnboardingGate } from '~/components/onboarding/onboarding-gate';
import { useSession } from '~/lib/session';
import { colors } from '~/theme/tokens';

export default function AppLayout() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}
      />
      {/* Onboarding wizard overlay — auto-opens once when the profile is
          incomplete (the Modal renders above the Stack). */}
      <OnboardingGate />
    </>
  );
}

const styles = {
  center: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.surface,
  },
};
