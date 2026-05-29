import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, apiGet } from '~/lib/api-client';
import { useSession } from '~/lib/session';

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
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>SIGNED IN</Text>
        <Text style={styles.email}>{session?.user.email ?? 'unknown'}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>GET /api/v1/onboarding/profile</Text>
          {isLoading ? (
            <ActivityIndicator color="#c9a87c" />
          ) : error ? (
            <Text style={styles.error}>
              {error instanceof ApiError
                ? `${error.code} (${error.status}) — ${error.message}`
                : String(error)}
            </Text>
          ) : (
            <Text style={styles.json}>{JSON.stringify(data, null, 2)}</Text>
          )}
        </View>

        <Pressable style={styles.secondary} onPress={() => refetch()} disabled={isRefetching}>
          <Text style={styles.secondaryText}>
            {isRefetching ? 'Refreshing…' : 'Refetch'}
          </Text>
        </Pressable>

        <Pressable style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fefbf6' },
  content: { padding: 24, gap: 12 },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#a8a29e',
    fontWeight: '700',
    marginTop: 8,
  },
  email: { fontSize: 22, color: '#2c2416', marginBottom: 8 },
  card: {
    borderWidth: 1,
    borderColor: '#e8d5b5',
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 13, color: '#8b7355', fontWeight: '600' },
  json: { fontSize: 12, color: '#2c2416' },
  error: { color: '#d37b69', fontSize: 14 },
  secondary: {
    borderWidth: 1,
    borderColor: '#e8d5b5',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  secondaryText: { color: '#2c2416', fontSize: 15, fontWeight: '500' },
  signOut: { paddingVertical: 14, alignItems: 'center' },
  signOutText: { color: '#d37b69', fontSize: 15, fontWeight: '500' },
});
