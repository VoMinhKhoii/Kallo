import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppHeader } from '~/components/app/app-header';
import { FeedArea, type LoggingProfile } from '~/components/logging/feed/feed-area';
import { TimelinePicker } from '~/components/logging/input/timeline-picker';
import { useTranslations } from '~/i18n';
import { apiGet } from '~/lib/api-client';
import { todayDateString } from '~/lib/logging/keys';
import { onboardingKeys } from '~/lib/onboarding/keys';
import { useMealDates } from '~/lib/logging/hooks/use-meal-dates';
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
  const tc = useTranslations('common');

  const { data, isLoading } = useQuery({
    queryKey: onboardingKeys.profile,
    queryFn: () => apiGet<ProfileRow>('/api/v1/onboarding/profile'),
    enabled: !!userId,
  });

  const { data: mealDates = [] } = useMealDates(userId);

  if (!userId) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text variant="small">{tc('notSignedIn')}</Text>
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
      {/* Header sits above the collapse scrim (zIndex) so the expanded strip's
          day cells + chevrons stay tappable while the scrim catches taps
          everywhere else. */}
      <View style={styles.header}>
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
      {/* Tap anywhere outside the strip collapses it (mirrors the web's
          outside-click-to-collapse on the expanded timeline). */}
      {pickerExpanded ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tc('close')}
          style={styles.collapseScrim}
          onPress={() => setPickerExpanded(false)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[6],
  },
  header: { paddingHorizontal: space[3], zIndex: 20 },
  // Transparent full-screen catcher beneath the header (zIndex 20) but above
  // the feed (default 0), so tapping the feed area collapses the strip.
  collapseScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
});
