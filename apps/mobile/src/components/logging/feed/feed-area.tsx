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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { PersistedMeal } from '@/lib/api/contracts/meals';
import { round0 } from '~/lib/logging/logic/format';
import { loggingDayKeys, todayDateString } from '~/lib/logging/keys';
import { useConfirmMeal } from '~/lib/logging/hooks/use-meal-mutations';
import { useLoggingDay } from '~/lib/logging/hooks/use-logging-day';
import { useStreamAnalysis } from '~/lib/logging/hooks/use-stream-analysis';
import { useTranslations } from '~/i18n';
import { Text } from '~/theme/text';
import { colors, radii, space } from '~/theme/tokens';
import { CalorieRing } from '../calorie-ring';
import { EmptyState } from './empty-state';
import { MealEntry } from './meal-entry';
import { MealInput, type MealInputHandle } from '../input/meal-input';
import { PersistedMealCard } from './persisted-meal-card';
import { StreamingEntry } from './streaming-entry';

export interface LoggingProfile {
  userId: string;
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
}

/** A single macro bar whose fill sweeps 0→pct (web macro-summary: width 0→%,
 *  duration 1s, delay 0.2s, easeOut). Extracted so the width hook isn't run
 *  inside the macro-bars .map. */
function MacroBar({ pct, color }: { pct: number; color: string }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withDelay(
      200,
      withTiming(pct, {
        duration: 1000,
        easing: Easing.out(Easing.ease),
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [pct, w]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View style={styles.macroTrack}>
      <Animated.View
        style={[styles.macroFill, fillStyle, { backgroundColor: color }]}
      />
    </View>
  );
}

export function FeedArea({
  profile,
  date,
}: {
  profile: LoggingProfile;
  date?: string;
}) {
  const td = useTranslations('dashboard');
  const tErrors = useTranslations('errors');
  const insets = useSafeAreaInsets();
  // The day being viewed/edited — defaults to today when no date is provided.
  const selectedDate = date ?? todayDateString();
  const queryClient = useQueryClient();
  const inputRef = useRef<MealInputHandle>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const { data: day, isLoading } = useLoggingDay(profile.userId, selectedDate);
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
        queryKey: loggingDayKeys.byUserDate(profile.userId, selectedDate),
      });
      queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
      stream.reset();
    }
  }, [stream, queryClient, profile.userId, selectedDate]);

  useEffect(() => {
    if (stream.status === 'error') {
      setErrorText(stream.error ?? tErrors('internal'));
      stream.reset();
    }
  }, [stream]);

  const dailyCalories = round0(
    persistedMeals.reduce((sum, m) => sum + (m.nutrition.caloriesKcal ?? 0), 0)
  );
  const dailyProtein = round0(
    persistedMeals.reduce((sum, m) => sum + (m.nutrition.proteinG ?? 0), 0)
  );
  const dailyCarbs = round0(
    persistedMeals.reduce((sum, m) => sum + (m.nutrition.carbohydrateG ?? 0), 0)
  );
  const dailyFat = round0(
    persistedMeals.reduce((sum, m) => sum + (m.nutrition.fatG ?? 0), 0)
  );

  const macroBars = [
    {
      key: 'protein',
      label: td('protein'),
      current: dailyProtein,
      target: profile.proteinTargetG,
      color: colors.macroProtein,
    },
    {
      key: 'carbs',
      label: td('carbs'),
      current: dailyCarbs,
      target: profile.carbsTargetG,
      color: colors.macroCarbs,
    },
    {
      key: 'fat',
      label: td('fat'),
      current: dailyFat,
      target: profile.fatTargetG,
      color: colors.macroFat,
    },
  ] as const;

  const isStreaming =
    stream.status !== 'idle' &&
    stream.status !== 'done' &&
    stream.status !== 'error';

  const submit = (text: string) => {
    setErrorText(null);
    inputRef.current?.clear();
    stream.analyze({
      message: text,
      loggedDate: selectedDate,
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
      {/* Web macro-summary enters opacity+y:-8 over 0.35s easeOut. */}
      <Animated.View
        style={styles.header}
        entering={FadeInUp.duration(350).reduceMotion(ReduceMotion.System)}
      >
        <View style={styles.ringColumn}>
          <CalorieRing current={dailyCalories} target={profile.calorieTarget} />
          <Text variant="numCaption">{`${dailyCalories} / ${profile.calorieTarget} kcal`}</Text>
        </View>
        <View style={styles.macroBars}>
          {macroBars.map(({ key, label, current, target, color }) => {
            const pct =
              target > 0
                ? Math.max(0, Math.min(100, (current / target) * 100))
                : 0;
            return (
              <View key={key} style={styles.macroRow}>
                <Text variant="macroLabel" style={styles.macroLabel}>
                  {label}
                </Text>
                <MacroBar pct={pct} color={color} />
                <Text variant="macroValue" style={styles.macroValue}>
                  {`${current}/${target}g`}
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      <FlatList
        data={persistedMeals}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          // Web fades each feed card in (motion.article opacity 0→1).
          <Animated.View
            entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
          >
            <PersistedMealCard meal={item} />
          </Animated.View>
        )}
        contentContainerStyle={
          persistedMeals.length === 0 ? styles.listEmpty : styles.list
        }
        ItemSeparatorComponent={() => <View style={styles.cardSeparator} />}
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
                    originDate: selectedDate,
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

      <View
        style={[styles.inputWrap, { paddingBottom: insets.bottom + space[2] }]}
      >
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
    paddingHorizontal: space[3],
    paddingTop: space[3],
    paddingBottom: space[2],
    backgroundColor: colors.surface,
  },
  ringColumn: { alignItems: 'center', gap: space[1] },
  macroBars: { flex: 1, gap: space[2] },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  macroLabel: { width: 48, color: colors.textMuted70 },
  macroTrack: {
    height: 6,
    flex: 1,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: colors.track,
  },
  macroFill: { height: '100%', borderRadius: radii.pill },
  macroValue: { width: 56 },
  list: { padding: space[3], paddingLeft: space[3] + space[6], flexGrow: 1 },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: space[6],
  },
  cardSeparator: { height: space[2] },
  loading: { marginTop: space[10] },
  error: {
    color: colors.danger,
    paddingHorizontal: space[3],
    paddingBottom: space[2],
  },
  inputWrap: {
    paddingHorizontal: space[3],
    paddingTop: space[2],
    paddingBottom: space[3],
  },
});
