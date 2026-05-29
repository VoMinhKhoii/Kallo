import { useQuery } from '@tanstack/react-query';
import { Flame } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { AppHeader } from '~/components/app/app-header';
import { AdherenceHeatmap } from '~/components/dashboard/adherence-heatmap';
import { SectionHeader, SectionState } from '~/components/dashboard/section-header';
import { WeightChart } from '~/components/dashboard/weight-chart';
import { CalorieRing } from '~/components/logging/calorie-ring';
import { useTranslations } from '~/i18n';
import { apiGet } from '~/lib/api-client';
import { round0 } from '~/lib/logging/format';
import { todayDateString } from '~/lib/logging/keys';
import { useLoggingDay } from '~/lib/logging/use-logging-day';
import { useSession } from '~/lib/session';
import { Card, Screen } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { colors, fonts, fontSize, radii, space } from '~/theme/tokens';

/**
 * Dashboard screen — mobile port of the web `DashboardShell`
 * (components/dashboard/dashboard-shell.tsx). A vertically scrolling stack of
 * the three web sections, in the web's order:
 *
 *   1. TODAY SUMMARY  — week title + TodayDock (calorie ring + macros + meals)
 *   2. PROGRESS       — "Progress" + 30-day badge + the single WeightChart card
 *                       (callout + TODAY'S WEIGHT input + chart)
 *   3. CONSISTENCY    — "Consistency" + 30-day badge + AdherenceHeatmap
 *
 * Section headers come from the shared SectionHeader. Sections 2 & 3 are
 * self-contained (their components own their hooks + loading/error/empty); the
 * Today section's loading/error replace the whole dock per the web shell.
 *
 * Mobile deviations (per the port plan):
 *  - No container measurement: the phone is always below the web's 620px / year
 *    thresholds, so the range badges are hardcoded "30 days" and the weight /
 *    heatmap queries run at the fixed '30d' range. The badges are passive labels
 *    (web derives the range from width; there are no interactive tabs).
 *  - The PROGRESS section is i18n'd via `~/i18n` (use-intl); the TODAY /
 *    CONSISTENCY copy is still the inlined English from messages/en.json.
 */

// EN copy (messages/en.json `dashboard.*`), sentence case.
const COPY = {
  consistency: 'Consistency',
  range30: '30 days',
  notSignedIn: 'Not signed in.',
} as const;

/**
 * Pure helper vendored from the web `getWeekTitle` (dashboard-shell.tsx). Builds
 * "Week of {Mon} – {Sun}, {year}" for the Monday-anchored week containing
 * today, via standard JS Date + Intl (both fine in app code).
 */
function getWeekTitle(locale: string, label: string, today: string): string {
  const now = new Date(today);
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(now.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatter = new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
  });
  const year = sunday.getFullYear();

  return `${label} ${formatter.format(monday)} – ${formatter.format(sunday)}, ${year}`;
}

// The onboarding profile row (the macro/calorie targets the dock needs).
type ProfileRow = {
  calorieTarget: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
} | null;

interface DockTargets {
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
}

export default function DashboardScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const todayDate = todayDateString();
  const t = useTranslations('dashboard');
  const weekTitle = useMemo(
    () => getWeekTitle('en', t('weekOf'), todayDate),
    [t, todayDate]
  );

  const profileQuery = useQuery({
    queryKey: ['onboarding', 'profile'],
    queryFn: () => apiGet<ProfileRow>('/api/v1/onboarding/profile'),
    enabled: !!userId,
  });

  if (!userId) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text variant="small">{COPY.notSignedIn}</Text>
        </View>
      </Screen>
    );
  }

  // Defaults mirror the web DEFAULT_PROFILE so an incomplete-onboarding profile
  // shows sensible targets, never /0g.
  const targets: DockTargets = {
    calorieTarget: profileQuery.data?.calorieTarget ?? 2000,
    proteinTargetG: profileQuery.data?.proteinTargetG ?? 150,
    carbsTargetG: profileQuery.data?.carbsTargetG ?? 250,
    fatTargetG: profileQuery.data?.fatTargetG ?? 65,
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: space[3] }}>
        <AppHeader />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1 — Today summary */}
        <View style={styles.section}>
          <SectionHeader title={weekTitle} />
          <TodaySection userId={userId} todayDate={todayDate} targets={targets} />
        </View>

        {/* SECTION 2 — Progress (weight trend + chart + weight log) */}
        <View style={styles.section}>
          <SectionHeader
            title={t('progress')}
            range={t('ranges.thirtyDays')}
          />
          <ProgressSection todayDate={todayDate} />
        </View>

        {/* SECTION 3 — Consistency (adherence heatmap) */}
        <View style={styles.section}>
          <SectionHeader title={t('consistency')} range={t('ranges.ninetyDays')} />
          <AdherenceHeatmap />
        </View>
      </ScrollView>
    </Screen>
  );
}

/* ---------------------------------------------------------------- Section 1 */

/**
 * TodayDock-equivalent (web components/dashboard/today/today-dock.tsx). Reuses
 * the logging `CalorieRing` (with a Flame center, like the web) and the
 * feed-area macro-bar markup. Adds the "Calories remaining" hero block and the
 * meal list that distinguish TodayDock from feed-area's header.
 */
function TodaySection({
  userId,
  todayDate,
  targets,
}: {
  userId: string;
  todayDate: string;
  targets: DockTargets;
}) {
  const t = useTranslations('dashboard');
  const { data: day, isPending, isError, refetch } = useLoggingDay(
    userId,
    todayDate
  );

  if (isPending) {
    return <SectionState message={t('todayLoading')} />;
  }
  if (isError) {
    return (
      <SectionState
        message={t('todayLoadError')}
        actionLabel={t('retry')}
        onAction={() => {
          void refetch();
        }}
      />
    );
  }

  const meals = [...(day.persistedMeals ?? [])].sort((a, b) =>
    a.loggedAt.localeCompare(b.loggedAt)
  );

  const totals = meals.reduce(
    (sum, m) => ({
      calories: sum.calories + (m.nutrition.caloriesKcal ?? 0),
      protein: sum.protein + (m.nutrition.proteinG ?? 0),
      carbs: sum.carbs + (m.nutrition.carbohydrateG ?? 0),
      fat: sum.fat + (m.nutrition.fatG ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const calories = round0(totals.calories);
  const remaining = Math.max(0, targets.calorieTarget - calories);

  const macroBars = [
    {
      key: 'protein',
      label: t('protein'),
      current: round0(totals.protein),
      target: targets.proteinTargetG,
      color: colors.macroProtein,
    },
    {
      key: 'carbs',
      label: t('carbs'),
      current: round0(totals.carbs),
      target: targets.carbsTargetG,
      color: colors.macroCarbs,
    },
    {
      key: 'fat',
      label: t('fat'),
      current: round0(totals.fat),
      target: targets.fatTargetG,
      color: colors.macroFat,
    },
  ] as const;

  return (
    // Web today-dock.tsx: motion.section initial {opacity:0,y:10} → {1,0} over
    // 0.45s. FadeInDown gives the fade + 10px up-slide in one entrance.
    <Animated.View
      entering={FadeInDown.duration(450).reduceMotion(ReduceMotion.System)}
    >
      <Card style={dock.card}>
        {/* (a) Calories remaining — cream hero block */}
      <View style={dock.remainingBlock}>
        <Text variant="eyebrow" style={dock.remainingEyebrow}>
          {t('caloriesRemaining')}
        </Text>
        <View style={dock.heroRow}>
          <Text style={dock.heroNumber}>{remaining.toLocaleString()}</Text>
          <Text style={dock.heroTarget}>
            / {targets.calorieTarget.toLocaleString()}
          </Text>
        </View>
        <Text style={dock.subline}>
          {calories.toLocaleString()} {t('caloriesLogged')}
        </Text>
      </View>

      {/* (b) Ring + macros — cream block */}
      <View style={dock.ringBlock}>
        <CalorieRing
          current={calories}
          target={targets.calorieTarget}
          size={72}
          strokeWidth={6}
          center={<Flame size={24} color={colors.accent} />}
        />
        <View style={dock.macroBars}>
          {macroBars.map(({ key, label, current, target, color }, idx) => {
            const pct =
              target > 0
                ? Math.max(0, Math.min(100, (current / target) * 100))
                : 0;
            return (
              <View key={key} style={dock.macroRow}>
                <Text variant="macroLabel" numberOfLines={1} style={dock.macroLabel}>
                  {label}
                </Text>
                <View style={dock.macroTrack}>
                  <MacroBar pct={pct} color={color} idx={idx} />
                </View>
                <Text variant="macroValue" style={dock.macroValue}>
                  {`${current}/${target}g`}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* (c) Meal list — cream block */}
      <View style={dock.mealBlock}>
        {meals.length === 0 ? (
          <View style={dock.mealEmpty}>
            <Text style={dock.mealEmptyTitle}>{t('noMealsToday')}</Text>
            <Text style={dock.mealEmptyHint}>{t('mealReceiptsHint')}</Text>
          </View>
        ) : (
          <>
            <View style={dock.mealHeader}>
              <Text variant="eyebrow" style={dock.mealHeaderLabel}>
                {t('recentMeals')}
              </Text>
              <Text style={dock.mealHeaderCount}>
                {t('mealsLogged', { count: meals.length })}
              </Text>
            </View>
            <View style={dock.mealRows}>
              {meals.map((meal, idx) => (
                <View key={meal.id} style={dock.mealRow}>
                  <View style={dock.mealRowLeft}>
                    <Text style={dock.mealIndex}>{idx + 1}</Text>
                    <Text
                      numberOfLines={2}
                      style={dock.mealLabel}
                    >
                      {meal.rawInput}
                    </Text>
                  </View>
                  <Text style={dock.mealCalories}>
                    {round0(meal.nutrition.caloriesKcal)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
        </View>
      </Card>
    </Animated.View>
  );
}

/**
 * One macro bar fill. Hooks can't run inside the `.map`, so the animated fill is
 * extracted here. Mirrors web macro-bars.tsx: width animates 0 → pct over 0.9s
 * with a per-bar stagger (idx*100 + 200ms lead-in) and the signature ease.
 */
function MacroBar({
  pct,
  color,
  idx,
}: {
  pct: number;
  color: string;
  idx: number;
}) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withDelay(
      idx * 100 + 200,
      withTiming(pct, {
        duration: 900,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [pct, idx, w]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <Animated.View style={[dock.macroFill, fillStyle, { backgroundColor: color }]} />
  );
}

/* ---------------------------------------------------------------- Section 2 */

/**
 * Progress section — a faithful 1:1 of the web ProgressStory
 * (components/dashboard/progress/progress-story.tsx). The single WeightChart
 * card now nests, in order, the trend callout, the TODAY'S WEIGHT input
 * (CompactWeightLog), and the SVG area chart — exactly as the web card does.
 * The card owns its own `useWeightSummary` query and loading/error states.
 */
function ProgressSection({ todayDate }: { todayDate: string }) {
  return <WeightChart todayDate={todayDate} />;
}

/* --------------------------------------------------------------------- root */

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  // px-3 py-3 pb-24 → 12 / 12, with a generous bottom pad for the tab bar.
  content: {
    paddingHorizontal: space[3],
    paddingTop: space[3],
    paddingBottom: space[20],
  },
  // Inter-section gap-4 (16px); header-to-content gap-1.5 (6px) inside.
  section: { marginBottom: space[4], gap: 6 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[6],
  },
});

// TodayDock styles. Card radius 24 (web rounded-[1.5rem]); inner blocks 18
// (radii['2xl'], the cream sub-panel family); cream-vs-white fills + hairlines.
const dock = StyleSheet.create({
  card: {
    borderRadius: radii['4xl'],
    borderColor: colors.borderSoft,
    padding: space[3],
    gap: space[3],
  },
  // (a) Calories remaining
  remainingBlock: {
    borderRadius: radii['2xl'],
    backgroundColor: colors.surface80,
    padding: space[3],
  },
  remainingEyebrow: { color: colors.stone },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: space[1],
  },
  heroNumber: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 36,
    lineHeight: 36,
    letterSpacing: -1.4,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  heroTarget: {
    fontFamily: fonts.serifItalic,
    fontSize: fontSize.lg,
    color: colors.textMuted,
  },
  subline: {
    marginTop: space[1],
    fontFamily: fonts.sansRegular,
    fontSize: fontSize.xs,
    color: colors.stone,
  },
  // (b) Ring + macros
  ringBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderRadius: radii['2xl'],
    backgroundColor: colors.surface80,
    padding: space[3],
  },
  // Web MacroBars container is gap-3.5 (14px) between the three macro rows.
  macroBars: { flex: 1, gap: 14 },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  // Keep the variant's 0.6 tracking — at 48px width a wider value wraps "PROTEIN".
  macroLabel: { width: 48 },
  macroTrack: {
    height: 6,
    flex: 1,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: colors.track,
  },
  macroFill: { height: '100%', borderRadius: radii.pill },
  macroValue: { width: 52 },
  // (c) Meal list
  mealBlock: {
    minHeight: 140,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface80,
    padding: 10,
  },
  mealEmpty: {
    flex: 1,
    minHeight: 116,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mealEmptyTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  mealEmptyHint: {
    fontFamily: fonts.sansRegular,
    fontSize: fontSize['2xs'],
    color: colors.stone,
    textAlign: 'center',
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space[2],
  },
  mealHeaderLabel: { fontSize: 9, letterSpacing: 1.4, color: colors.stone },
  mealHeaderCount: {
    fontFamily: fonts.sansRegular,
    fontSize: 9,
    color: colors.stone,
  },
  mealRows: { gap: 6 },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[2],
    borderRadius: radii.buttonXl,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mealRowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    flexShrink: 1,
  },
  mealIndex: {
    fontFamily: fonts.serifRegular,
    fontSize: fontSize.eyebrow,
    lineHeight: fontSize.eyebrow,
    color: colors.accent,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  mealLabel: {
    flexShrink: 1,
    fontFamily: fonts.sansRegular,
    fontSize: fontSize['2xs'],
    lineHeight: 14,
    color: colors.text,
  },
  mealCalories: {
    fontFamily: fonts.sansRegular,
    fontSize: fontSize.eyebrow,
    color: colors.stone,
    fontVariant: ['tabular-nums'],
  },
});
