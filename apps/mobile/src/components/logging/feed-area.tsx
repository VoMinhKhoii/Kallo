import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import type { PersistedMeal } from '@/lib/api/contracts/meals';
import { round0 } from '~/lib/logging/format';
import { loggingDayKeys, todayDateString } from '~/lib/logging/keys';
import { useConfirmMeal } from '~/lib/logging/use-meal-mutations';
import { useLoggingDay } from '~/lib/logging/use-logging-day';
import { useStreamAnalysis } from '~/lib/logging/use-stream-analysis';
import { Text } from '~/theme/text';
import { colors, space } from '~/theme/tokens';
import { CalorieRing } from './calorie-ring';
import { EmptyState } from './empty-state';
import { MealEntry } from './meal-entry';
import { MealInput, type MealInputHandle } from './meal-input';
import { PersistedMealCard } from './persisted-meal-card';
import { StreamingEntry } from './streaming-entry';

export interface LoggingProfile {
  userId: string;
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
}

export function FeedArea({ profile }: { profile: LoggingProfile }) {
  const today = todayDateString();
  const queryClient = useQueryClient();
  const inputRef = useRef<MealInputHandle>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const { data: day, isLoading } = useLoggingDay(profile.userId, today);
  const stream = useStreamAnalysis();
  const confirmMeal = useConfirmMeal(profile.userId);

  const persistedMeals: PersistedMeal[] = [...(day?.persistedMeals ?? [])].sort(
    (a, b) => a.loggedAt.localeCompare(b.loggedAt)
  );
  const pendingConfirmations = day?.pendingConfirmations ?? [];

  // On stream completion the server has stored a pending analysis — refetch so
  // it appears as a confirmable card, then clear the local stream.
  useEffect(() => {
    if (stream.status === 'done' && stream.analysisId) {
      queryClient.invalidateQueries({
        queryKey: loggingDayKeys.byUserDate(profile.userId, today),
      });
      queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
      stream.reset();
    }
  }, [stream, queryClient, profile.userId, today]);

  useEffect(() => {
    if (stream.status === 'error') {
      setErrorText(stream.error ?? 'Something went wrong. Please try again.');
      stream.reset();
    }
  }, [stream]);

  const dailyCalories = round0(
    persistedMeals.reduce((sum, m) => sum + (m.nutrition.caloriesKcal ?? 0), 0)
  );

  const isStreaming =
    stream.status !== 'idle' &&
    stream.status !== 'done' &&
    stream.status !== 'error';

  const submit = (text: string) => {
    setErrorText(null);
    inputRef.current?.clear();
    stream.analyze({
      message: text,
      loggedDate: today,
      timezoneOffset: new Date().getTimezoneOffset(),
    });
  };

  const handleSuggestion = (s: string) => {
    inputRef.current?.setText(s);
    inputRef.current?.focus();
  };

  const isEmpty =
    !isLoading &&
    persistedMeals.length === 0 &&
    pendingConfirmations.length === 0 &&
    !isStreaming;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <CalorieRing current={dailyCalories} target={profile.calorieTarget} />
        <View style={styles.headerText}>
          <Text variant="eyebrow">Today</Text>
          <Text variant="small">{`${dailyCalories} / ${profile.calorieTarget} kcal`}</Text>
        </View>
      </View>

      <FlatList
        data={persistedMeals}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <PersistedMealCard meal={item} />}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          isEmpty ? (
            <EmptyState onSuggestion={handleSuggestion} />
          ) : isLoading ? (
            <ActivityIndicator color={colors.accent} style={styles.loading} />
          ) : null
        }
        ListFooterComponent={
          <View>
            {pendingConfirmations.map((p) => (
              <MealEntry
                key={p.id}
                rawInput={p.rawInput}
                parsedMeal={p.parsedMeal}
                busy={confirmMeal.isPending}
                onConfirm={(edits) =>
                  confirmMeal.mutate({
                    analysisId: p.id,
                    mealId: randomUUID(),
                    originDate: today,
                    edits: edits.length > 0 ? edits : undefined,
                  })
                }
              />
            ))}
            {isStreaming ? (
              <StreamingEntry
                status={stream.status}
                items={stream.items}
                completedItems={stream.completedItems}
              />
            ) : null}
          </View>
        }
      />

      {errorText ? (
        <Text variant="small" style={styles.error}>
          {errorText}
        </Text>
      ) : null}

      <View style={styles.inputWrap}>
        <MealInput
          ref={inputRef}
          onSubmit={submit}
          onCancel={stream.cancel}
          disabled={stream.isAnalyzing}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingHorizontal: space[5],
    paddingVertical: space[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: { flex: 1, gap: space[1] },
  list: { padding: space[5], flexGrow: 1 },
  loading: { marginTop: space[10] },
  error: {
    color: colors.danger,
    paddingHorizontal: space[5],
    paddingBottom: space[2],
  },
  inputWrap: {
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
