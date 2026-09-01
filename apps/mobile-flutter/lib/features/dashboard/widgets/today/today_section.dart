/// TodaySection — the dashboard's calorie/macro/meals dock.
///
/// 2026 redesign: ONE flat white card (no nested translucent cream blocks), the
/// calorie-remaining number as the bold-sans hero, macro bars with readable
/// values, and a plain meal list. Zones are separated by whitespace, not by
/// stacked fills. See `theme/calm_tokens.dart` for the type/color system.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../data/dashboard_providers.dart';
import '../../data/logging_day.dart';
import '../../../../shared/logic/display_format.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../shared/widgets/typography/section_header_row.dart';
import '../../logic/dashboard_spacing.dart';
import '../states/card_skeletons.dart';
import '../states/section_state.dart';
import 'dock_targets.dart';
import 'fade_in_down.dart';
import '../../../../shared/widgets/gauge/calorie_dial.dart';
import '../../../../shared/widgets/gauge/macro_dial_row.dart';
import 'today_first_run.dart';
import 'today_meal_list.dart';

class TodaySection extends ConsumerWidget {
  const TodaySection({
    super.key,
    required this.args,
    required this.targets,
    required this.dateLabel,
    this.isToday = true,
    this.isFirstRun = false,
  });

  final DashboardArgs args;
  final DockTargets targets;

  /// A human date line shown at the top of the card ("Today", "Yesterday", or a
  /// localized "Mon, Jun 9"). The card always says which day it is showing.
  final String dateLabel;

  /// Whether [args] is today. Today reads off the already-warm dashboard bundle
  /// (no extra round-trip); other days fetch their own light per-day slice.
  final bool isToday;

  /// The user has never logged anything, ever — collapse to the first-run card.
  final bool isFirstRun;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (isFirstRun) return const FirstRunCard();

    // Today reads the bundle's day slice (warm cache, seam parity with the rest
    // of the dashboard); any other day fetches its own slice so browsing never
    // refetches the 90d heatmap + profile + weight bundle.
    final provider =
        isToday ? loggingDayProvider(args) : dashboardDayProvider(args);
    final async = ref.watch(provider);
    return async.when(
      loading:
          () => const Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [DashSkeletonHeader(), TodayCardSkeleton()],
          ),
      error:
          (_, __) => SectionState(
            icon: LucideIcons.cloudOff300,
            message: tr('dashboard.todayLoadError'),
            actionLabel: tr('dashboard.retry'),
            onAction: () => ref.invalidate(provider),
          ),
      data: (day) => _Dock(day: day, targets: targets, dateLabel: dateLabel),
    );
  }
}

class _Dock extends StatelessWidget {
  const _Dock({
    required this.day,
    required this.targets,
    required this.dateLabel,
  });

  final LoggingDayData day;
  final DockTargets targets;
  final String dateLabel;

  @override
  Widget build(BuildContext context) {
    final meals = [...day.persistedMeals]
      ..sort((a, b) => a.loggedAt.compareTo(b.loggedAt));

    var totalCalories = 0.0;
    var totalProtein = 0.0;
    var totalCarbs = 0.0;
    var totalFat = 0.0;
    for (final m in meals) {
      totalCalories += m.nutrition.caloriesKcal ?? 0;
      totalProtein += m.nutrition.proteinG ?? 0;
      totalCarbs += m.nutrition.carbohydrateG ?? 0;
      totalFat += m.nutrition.fatG ?? 0;
    }
    final calories = round0(totalCalories);

    return FadeInDown(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Which day this is showing. On the SECTION tier (17/600 ink), not
          // the quieter group-label one it used to wear: it is the first
          // section header on the page, and at 15/500 muted it announced
          // itself in a smaller voice than "Recent meals" directly below and
          // "Progress" below that. Same widget, same inset, same rhythm as its
          // siblings — the dock pages to other days and this is the only line
          // that says which one.
          Padding(
            padding: const EdgeInsets.only(bottom: DashboardSpacing.block),
            child: SectionHeaderRow(title: dateLabel),
          ),

          // (a) The calorie dial, straight on the canvas. No card: the arc
          // draws its own shape, and a border around a round mark only fenced
          // it in.
          CalorieDial(
            logged: calories.toDouble(),
            target: targets.calorieTarget,
            goal: targets.goal,
          ),

          const SizedBox(height: DashboardSpacing.block),

          // (b) The three macros, the same dial a third of the size.
          MacroDialRow(
            current: {
              'protein': round0(totalProtein),
              'carbohydrate': round0(totalCarbs),
              'fat': round0(totalFat),
            },
            target: {
              'protein': targets.proteinTargetG.round(),
              'carbohydrate': targets.carbsTargetG.round(),
              'fat': targets.fatTargetG.round(),
            },
          ),

          const SizedBox(height: DashboardSpacing.sectionBreak),

          // (c) The meals behind those numbers — the one place on the section
          // that still takes a card, because a list needs an edge to sit on.
          Padding(
            padding: const EdgeInsets.only(bottom: DashboardSpacing.block),
            child: SectionHeaderRow(
              title: tr('dashboard.recentMeals'),
              meta: tr(
                'dashboard.mealsLogged',
                namedArgs: {'count': '${meals.length}'},
              ),
            ),
          ),
          KalloCard(
            // A list card insets only its sides — each row pays its own
            // vertical padding, so the separators land between rows.
            padding:
                meals.isEmpty
                    ? DashboardSpacing.card
                    : DashboardSpacing.rowCard,
            child: meals.isEmpty ? const EmptyMeals() : MealList(meals: meals),
          ),
        ],
      ),
    );
  }
}
