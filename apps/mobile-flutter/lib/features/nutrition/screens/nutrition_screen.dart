import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/session_provider.dart';
import '../../../models/nutrition.dart';
import '../../../shared/widgets/nham_primitives.dart';
import '../../../shared/widgets/nham_text.dart';
import '../../../shell/app_header.dart';
import '../../../theme/nham_colors.dart';
import '../providers/nutrition_overview_provider.dart';
import '../widgets/background_section.dart';
import '../widgets/daily_rhythm.dart';
import '../widgets/editorial_header.dart';
import '../widgets/empty_state.dart';
import '../widgets/focus_section.dart';
import '../widgets/inline_error.dart';
import '../widgets/nutrition_skeleton.dart';
import '../widgets/pull_quote.dart';
import '../widgets/steady_section.dart';
import '../widgets/verdict_hero.dart';

/// Nutrition screen — mobile port of the web `NutritionShell`
/// (`apps/mobile/src/app/(app)/(tabs)/nutrition.tsx`). A purely client-query
/// editorial stack: header (with interactive 7d/30d/90d range toggle + verdict)
/// → calorie rhythm card → focus spotlights → steady nutrient list → "other
/// nutrients" toggle → vitamin-D pull-quote.
///
/// Single column throughout (the web's lg:two-up + sm:2-col grids collapse on
/// phone); the AnimatePresence height-collapse becomes an `AnimatedSize` fade.
class NutritionScreen extends ConsumerStatefulWidget {
  const NutritionScreen({super.key});

  @override
  ConsumerState<NutritionScreen> createState() => _NutritionScreenState();
}

class _NutritionScreenState extends ConsumerState<NutritionScreen> {
  NutritionRangeInput _range = NutritionRangeInput.auto;

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(currentSessionProvider);
    final userId = session?.user.id;

    if (userId == null) {
      return const Screen(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: NhamText('Not signed in.', variant: NhamTextVariant.small),
          ),
        ),
      );
    }

    // A refetch that fails while we still hold a prior overview keeps the
    // content on screen (copyWithPrevious) and surfaces the failure as a toast
    // instead of nuking what the user is reading.
    ref.listen<AsyncValue<NutritionOverview>>(
      nutritionOverviewProvider(_range),
      (prev, next) {
        if (next.hasError && next.hasValue) {
          final messenger = ScaffoldMessenger.of(context);
          messenger.clearSnackBars();
          messenger.showSnackBar(
            SnackBar(
              content: NhamText(
                tr('nutrition.errors.overviewToast'),
                variant: NhamTextVariant.body,
                style: const TextStyle(color: NhamColors.surface),
              ),
            ),
          );
        }
      },
    );

    final async = ref.watch(nutritionOverviewProvider(_range));
    // `isFetching`: a refetch in flight while previous data is shown.
    final isFetching = async.isLoading && async.hasValue;

    return Screen(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: AppHeader(),
          ),
          Expanded(
            // Native bounce physics (the only screen that was forced to
            // Clamping) + pull-to-refresh, consistent with the rest of the app.
            child: RefreshIndicator(
              onRefresh: () => ref
                  .read(nutritionOverviewProvider(_range).notifier)
                  .refetch(),
              color: NhamColors.accent,
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 80),
                physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics(),
                ),
                child: _buildBody(async, isFetching),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(AsyncValue<NutritionOverview> async, bool isFetching) {
    // isLoading with no prior value → skeleton (RN query.isLoading).
    if (async.isLoading && !async.hasValue) {
      return const NutritionSkeleton();
    }

    final overview = async.valueOrNull;
    if (async.hasError && overview == null) {
      return InlineError(
        isRetrying: isFetching,
        message: tr('nutrition.errors.overview'),
        retryLabel: tr('nutrition.errors.retry'),
        onRetry: () {
          ref
              .read(nutritionOverviewProvider(_range).notifier)
              .refetch();
        },
      );
    }

    if (overview == null) {
      // Error path with no data fallback (mirrors RN `|| !overview`).
      return InlineError(
        isRetrying: isFetching,
        message: tr('nutrition.errors.overview'),
        retryLabel: tr('nutrition.errors.retry'),
        onRetry: () {
          ref
              .read(nutritionOverviewProvider(_range).notifier)
              .refetch();
        },
      );
    }

    final isEmpty = overview.loggedDays == 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        EditorialHeader(
          resolvedRange: overview.resolvedRange,
          onRangeChange: (range) => setState(() => _range = range),
          startDate: overview.period.startDate,
          endDate: overview.period.endDate,
          disabled: isFetching,
          verdict: isEmpty ? null : VerdictHero(overview: overview),
        ),
        if (isEmpty) ...[
          const SizedBox(height: 48),
          const EmptyState(),
        ] else ...[
          const SizedBox(height: 48),
          DailyRhythm(macros: overview.macros),
          const SizedBox(height: 48),
          FocusSection(cards: overview.spotlight),
          const SizedBox(height: 48),
          SteadySection(cards: overview.steady),
          const SizedBox(height: 48),
          BackgroundSection(cards: overview.moreNutrients),
          for (final card in overview.educationCards) ...[
            const SizedBox(height: 48),
            PullQuote(card: card),
          ],
        ],
      ],
    );
  }
}
