import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, View } from 'react-native';
import { FeedArea, type LoggingProfile } from '~/components/logging/feed-area';
import { apiGet } from '~/lib/api-client';
import { useSession } from '~/lib/session';
import { Screen } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { colors, space } from '~/theme/tokens';

// The onboarding profile row (the fields the logging screen needs).
type ProfileRow = {
  calorieTarget: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
} | null;

export default function LoggingScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding', 'profile'],
    queryFn: () => apiGet<ProfileRow>('/api/v1/onboarding/profile'),
    enabled: !!userId,
  });

  if (!userId) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text variant="small">Not signed in.</Text>
        </View>
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  const profile: LoggingProfile = {
    userId,
    calorieTarget: data?.calorieTarget ?? 2000,
    proteinTargetG: data?.proteinTargetG ?? 0,
    carbsTargetG: data?.carbsTargetG ?? 0,
    fatTargetG: data?.fatTargetG ?? 0,
  };

  return (
    <Screen edges={['top']}>
      <FeedArea profile={profile} />
    </Screen>
  );
}

const styles = {
  center: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: space[6],
  },
};
