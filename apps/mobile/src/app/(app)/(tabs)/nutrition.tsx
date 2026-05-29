import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NutritionRangeInput } from '@/lib/nutrition/types';
import { AppHeader } from '~/components/app/app-header';
import { BackgroundSection } from '~/components/nutrition/background-section';
import { DailyRhythm } from '~/components/nutrition/daily-rhythm';
import { EditorialHeader } from '~/components/nutrition/editorial-header';
import { EmptyState } from '~/components/nutrition/empty-state';
import { FocusSection } from '~/components/nutrition/focus-section';
import { InlineError } from '~/components/nutrition/inline-error';
import { NutritionSkeleton } from '~/components/nutrition/nutrition-skeleton';
import { PullQuote } from '~/components/nutrition/pull-quote';
import { SteadySection } from '~/components/nutrition/steady-section';
import { VerdictHero } from '~/components/nutrition/verdict-hero';
import { useTranslations } from '~/i18n';
import { useNutritionOverview } from '~/lib/nutrition/use-nutrition-overview';
import { useSession } from '~/lib/session';
import { Screen } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { colors, space } from '~/theme/tokens';

/**
 * Nutrition screen — mobile port of the web `NutritionShell`
 * (components/nutrition/nutrition-shell.tsx). A purely client-query editorial
 * stack: header (with interactive 7d/30d/90d range toggle + verdict) → calorie
 * rhythm card → focus spotlights → steady nutrient list → "other nutrients"
 * toggle → vitamin-D pull-quote.
 *
 * Mobile deviations (per the port plan): single column throughout (the web's
 * lg:two-up + sm:2-col grids collapse on phone); section entrance fades are
 * dropped; the AnimatePresence height-collapse becomes a Reanimated fade.
 */
export default function NutritionScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const t = useTranslations('nutrition');
  const [range, setRange] = useState<NutritionRangeInput>('auto');
  const query = useNutritionOverview(range, !!userId);

  if (!userId) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text variant="small">Not signed in.</Text>
        </View>
      </Screen>
    );
  }

  const overview = query.data;
  const isEmpty = overview ? overview.loggedDays === 0 : false;

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
        {query.isLoading ? (
          <NutritionSkeleton />
        ) : query.isError || !overview ? (
          <InlineError
            isRetrying={query.isFetching}
            message={t('errors.overview')}
            onRetry={() => {
              void query.refetch();
            }}
            retryLabel={t('errors.retry')}
          />
        ) : (
          <View style={styles.stack}>
            <EditorialHeader
              resolvedRange={overview.resolvedRange}
              onRangeChange={setRange}
              startDate={overview.period.startDate}
              endDate={overview.period.endDate}
              disabled={query.isFetching}
              verdict={isEmpty ? undefined : <VerdictHero overview={overview} />}
            />

            {isEmpty ? (
              <EmptyState />
            ) : (
              <>
                <DailyRhythm macros={overview.macros} />
                <FocusSection cards={overview.spotlight} />
                <SteadySection cards={overview.steady} />
                <BackgroundSection cards={overview.moreNutrients} />
                {overview.educationCards.map((card) => (
                  <PullQuote key={card.id} card={card} />
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space[3],
    paddingTop: space[3],
    paddingBottom: space[20],
  },
  // Editorial rhythm — the web's gap-12 (48px), tightened a touch for phone.
  stack: { gap: space[10] },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[6],
  },
});
