import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { ApiError, apiGet } from '~/lib/api-client';
import { useSession } from '~/lib/session';
import { Button, Card, Screen } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { colors, fonts, space } from '~/theme/tokens';

/**
 * Minimal Phase-2 home screen: proves session -> Bearer -> authed REST call.
 * The full logging UI lands in Phase 3; this just renders the profile JSON so
 * we can confirm the round-trip end to end on a device.
 */
type OnboardingProfile = {
  onboardingStep?: number | null;
  goal?: string | null;
  calorieTarget?: number | null;
  preferredLocale?: string | null;
} | null;

export default function Home() {
  const { session, signOut } = useSession();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['onboarding', 'profile'],
    queryFn: () => apiGet<OnboardingProfile>('/api/v1/onboarding/profile'),
  });

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="eyebrow">Signed in</Text>
        <Text variant="h3">{session?.user.email ?? 'unknown'}</Text>

        <Card>
          <Text variant="small" style={styles.cardTitle}>
            GET /api/v1/onboarding/profile
          </Text>
          {isLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : error ? (
            <Text variant="small" style={styles.error}>
              {error instanceof ApiError
                ? `${error.code} (${error.status}) — ${error.message}`
                : String(error)}
            </Text>
          ) : (
            <Text variant="meta" style={styles.json}>
              {JSON.stringify(data, null, 2)}
            </Text>
          )}
        </Card>

        <Button
          title={isRefetching ? 'Refreshing…' : 'Refetch'}
          variant="secondary"
          onPress={() => refetch()}
          disabled={isRefetching}
        />
        <Button title="Sign out" variant="danger" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[6], gap: space[3] },
  cardTitle: { marginBottom: space[2], color: colors.textMuted },
  json: { fontFamily: fonts.sansRegular, color: colors.text },
  error: { color: colors.danger },
});
