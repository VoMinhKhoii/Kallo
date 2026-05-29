import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AppHeader } from '~/components/app/app-header';
import { FeedArea, type LoggingProfile } from '~/components/logging/feed-area';
import { TimelinePicker } from '~/components/logging/timeline-picker';
import { apiGet } from '~/lib/api-client';
import { todayDateString } from '~/lib/logging/keys';
import { useMealDates } from '~/lib/logging/use-meal-dates';
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

  // Owned here so the date strip (in the header) and the feed share one source
  // of truth — mirrors the web LoggingShell's selectedDate.
  const today = todayDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [pickerExpanded, setPickerExpanded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding', 'profile'],
    queryFn: () => apiGet<ProfileRow>('/api/v1/onboarding/profile'),
    enabled: !!userId,
  });

  const { data: mealDates = [] } = useMealDates(userId);

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
    // Defaults mirror the web's DEFAULT_PROFILE (app/[locale]/(app)/logging/page.tsx)
    // so an incomplete-onboarding profile shows sensible targets, never /0g.
    calorieTarget: data?.calorieTarget ?? 2000,
    proteinTargetG: data?.proteinTargetG ?? 150,
    carbsTargetG: data?.carbsTargetG ?? 250,
    fatTargetG: data?.fatTargetG ?? 65,
  };

  return (
    <Screen edges={['top']}>
      <View style={{ paddingHorizontal: space[3] }}>
        <AppHeader expanded={pickerExpanded}>
          <TimelinePicker
            dates={mealDates}
            today={today}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            expanded={pickerExpanded}
            onExpandedChange={setPickerExpanded}
          />
        </AppHeader>
      </View>
      <FeedArea profile={profile} date={selectedDate} />
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
