/// TodaySection — the dashboard's calorie/macro/meals dock.
///
/// 2026 redesign: ONE flat white card (no nested translucent cream blocks), the
/// calorie-remaining number as the bold-sans hero, macro bars with readable
/// values, and a plain meal list. Zones are separated by whitespace, not by
/// stacked fills. See `dashboard_tokens.dart` for the type/color system.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../logging/widgets/count_up.dart';
import '../data/dashboard_providers.dart';
import '../data/logging_day.dart';
import '../logic/dashboard_format.dart';
import 'calorie_ring.dart';
import 'dashboard_tokens.dart';
import 'section_header.dart';

/// Per-screen dock targets (profile values, with the web DEFAULT_PROFILE
/// fallbacks applied by the screen).
class DockTargets {
  const DockTargets({
    required this.calorieTarget,
    required this.proteinTargetG,
    required this.carbsTargetG,
    required this.fatTargetG,
  });

  final double calorieTarget;
  final double proteinTargetG;
  final double carbsTargetG;
  final double fatTargetG;
}

/// Shared right-hand column width: the macro `x/yg` values and the meal-row
/// kcal sit in this fixed column so both align to one right edge.
const double _valueColumnWidth = 68;

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
    if (isFirstRun) return const _FirstRunCard();

    // Today reads the bundle's day slice (warm cache, seam parity with the rest
    // of the dashboard); any other day fetches its own slice so browsing never
    // refetches the 90d heatmap + profile + weight bundle.
    final provider =
        isToday ? loggingDayProvider(args) : dashboardDayProvider(args);
    final async = ref.watch(provider);
    return async.when(
      loading: () => SectionState(message: tr('dashboard.todayLoading')),
      error: (_, __) => SectionState(
        message: tr('dashboard.todayLoadError'),
        actionLabel: tr('dashboard.retry'),
        onAction: () => ref.invalidate(provider),
      ),
      data: (day) => _Dock(day: day, targets: targets, dateLabel: dateLabel),
    );
  }
}

/// First-run collapse: a single Lora question, no ring, no "% on track". Shown
/// only when the user has never logged a meal (zero today AND zero history).
class _FirstRunCard extends StatelessWidget {
  const _FirstRunCard();

  @override
  Widget build(BuildContext context) {
    return _FadeInDown(
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(
            vertical: NhamSpacing.sp6, horizontal: NhamSpacing.sp4),
        decoration: BoxDecoration(
          color: kCardSurface,
          borderRadius: BorderRadius.circular(kCardRadius),
          boxShadow: const [kCardShadow],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(tr('dashboard.firstRunQuestion'), style: dashHeadline()),
            const SizedBox(height: NhamSpacing.sp2),
            Text(
              tr('dashboard.firstRunHint'),
              style: dashBody(color: kInkSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

class _MacroBarData {
  const _MacroBarData(this.label, this.current, this.target, this.color);
  final String label;
  final int current;
  final int target;
  final Color color;
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
    final locale = context.locale.toString();
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
    // Honest signed remaining — negative when over target (no censoring clamp).
    final remaining = (targets.calorieTarget - calories).round();
    final overTarget = remaining < 0;

    final macroBars = <_MacroBarData>[
      _MacroBarData(tr('dashboard.protein'), round0(totalProtein),
          targets.proteinTargetG.round(), NhamColors.macroProtein),
      _MacroBarData(tr('dashboard.carbs'), round0(totalCarbs),
          targets.carbsTargetG.round(), NhamColors.macroCarbs),
      _MacroBarData(tr('dashboard.fat'), round0(totalFat),
          targets.fatTargetG.round(), NhamColors.macroFat),
    ];

    return _FadeInDown(
      child: Container(
        padding: const EdgeInsets.all(NhamSpacing.sp4),
        decoration: BoxDecoration(
          color: kCardSurface, // solid white
          borderRadius: BorderRadius.circular(kCardRadius),
          boxShadow: const [kCardShadow], // shadow only, no border
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Date line — the card always names the day it is showing.
            Padding(
              padding: const EdgeInsets.only(bottom: NhamSpacing.sp3),
              child: Text(dateLabel, style: dashEyebrow(color: kInkSecondary)),
            ),
            // (a) Hero: big calories number on the left, ring on the right.
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        (overTarget
                                ? tr('dashboard.caloriesOverTarget')
                                : tr('dashboard.caloriesRemaining'))
                            .toUpperCase(),
                        // OVER TARGET flips to espresso ink — never red.
                        style: dashEyebrow(
                          color: overTarget ? kInk : kInkSecondary,
                        ),
                      ),
                      const SizedBox(height: NhamSpacing.sp1),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Flexible(
                            // Counts the remaining figure up on day-swap (~300ms)
                            // so paging settles in place instead of popping.
                            child: CountUpText(
                              value: remaining.abs().toDouble(),
                              enabled:
                                  !MediaQuery.disableAnimationsOf(context),
                              duration: const Duration(milliseconds: 300),
                              style: dashHero(),
                              format: (v) => _fmt(v.round(), locale),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            overTarget
                                ? tr('dashboard.over')
                                : '/ ${_fmt(targets.calorieTarget.round(), locale)}',
                            style: dashBody(color: kInkSecondary),
                          ),
                        ],
                      ),
                      const SizedBox(height: NhamSpacing.sp1),
                      Text(
                        '${_fmt(calories, locale)} ${tr('dashboard.caloriesLogged')}',
                        style: dashMeta(color: kInkDisabled),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: NhamSpacing.sp4),
                CalorieRing(
                  current: calories.toDouble(),
                  target: targets.calorieTarget,
                  size: 84,
                  strokeWidth: 6,
                  center: const Icon(LucideIcons.flame, size: 22, color: kInk),
                ),
              ],
            ),

            const SizedBox(height: NhamSpacing.sp5),

            // (b) Macro bars — full width.
            for (var i = 0; i < macroBars.length; i++) ...[
              if (i > 0) const SizedBox(height: NhamSpacing.sp3),
              _MacroRow(bar: macroBars[i], idx: i),
            ],

            const _Separator(),

            // (c) Meal list — plain, on the card surface (no nested fill).
            meals.isEmpty ? _EmptyMeals() : _MealList(meals: meals),
          ],
        ),
      ),
    );
  }

  // Locale-aware thousands grouping (en → "2,000", vi → "2.000").
  static String _fmt(int n, String locale) => formatCount(n, locale);
}

/// A hairline divider between the card's zones (hero · macros · meals).
/// Full content-width (stretched by the card Column) so it lines up with every
/// row's left/right edges.
class _Separator extends StatelessWidget {
  const _Separator();

  @override
  Widget build(BuildContext context) => Container(
        height: 1,
        margin: const EdgeInsets.symmetric(vertical: NhamSpacing.sp4),
        color: const Color(0xFFE4E1DC), // soft neutral grey hairline
      );
}

class _MacroRow extends StatelessWidget {
  const _MacroRow({required this.bar, required this.idx});
  final _MacroBarData bar;
  final int idx;

  @override
  Widget build(BuildContext context) {
    final pct = bar.target > 0
        ? ((bar.current / bar.target) * 100).clamp(0, 100).toDouble()
        : 0.0;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SizedBox(
          width: 72,
          child: Text(
            bar.label.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.visible,
            softWrap: false,
            style: dashEyebrow(color: kInk),
          ),
        ),
        const SizedBox(width: NhamSpacing.sp3),
        Expanded(child: _MacroBar(pct: pct, color: bar.color, idx: idx)),
        const SizedBox(width: NhamSpacing.sp3),
        // Fixed-width right column so every bar ends at the same x and the
        // values line up (shared with the meal-row kcal column).
        SizedBox(
          width: _valueColumnWidth,
          child: Text(
            '${bar.current}/${bar.target}g',
            textAlign: TextAlign.right,
            style: dashMeta(color: kInk, tabular: true),
          ),
        ),
      ],
    );
  }
}

/// One macro bar fill: h-2 (8px) track, fill animates 0 → pct over 900ms with
/// a per-bar stagger (idx*100 + 200ms lead-in) and the signature ease.
class _MacroBar extends StatefulWidget {
  const _MacroBar({required this.pct, required this.color, required this.idx});
  final double pct;
  final Color color;
  final int idx;

  @override
  State<_MacroBar> createState() => _MacroBarState();
}

class _MacroBarState extends State<_MacroBar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );
  late Animation<double> _fill = _build();

  static const Curve _ease = Cubic(0.16, 1, 0.3, 1);

  Animation<double> _build() => Tween<double>(begin: 0, end: widget.pct).animate(
        CurvedAnimation(parent: _c, curve: _ease),
      );

  @override
  void initState() {
    super.initState();
    Future.delayed(Duration(milliseconds: widget.idx * 100 + 200), () {
      if (mounted) _c.forward();
    });
  }

  @override
  void didUpdateWidget(_MacroBar old) {
    super.didUpdateWidget(old);
    if (old.pct != widget.pct) {
      _fill = _build();
      _c
        ..reset()
        ..forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Reduced motion: render the fill at its resting width, no sweep.
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    return ClipRRect(
      borderRadius: BorderRadius.circular(NhamRadii.pill),
      child: Container(
        height: 8, // h-2
        color: kTrack,
        child: LayoutBuilder(
          builder: (context, constraints) => AnimatedBuilder(
            animation: _fill,
            builder: (context, _) => Align(
              alignment: Alignment.centerLeft,
              child: Container(
                width: constraints.maxWidth *
                    ((reduceMotion ? widget.pct : _fill.value) / 100),
                height: 8,
                decoration: BoxDecoration(
                  color: widget.color,
                  borderRadius: BorderRadius.circular(NhamRadii.pill),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Empty state — plain centered text on the card surface (no dashed border).
class _EmptyMeals extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 96),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            tr('dashboard.noMealsToday'),
            textAlign: TextAlign.center,
            style: dashBody(weight: FontWeight.w600),
          ),
          const SizedBox(height: NhamSpacing.sp1),
          Text(
            tr('dashboard.mealReceiptsHint'),
            textAlign: TextAlign.center,
            style: dashMeta(color: kInkDisabled),
          ),
        ],
      ),
    );
  }
}

class _MealList extends StatelessWidget {
  const _MealList({required this.meals});
  final List<PersistedMeal> meals;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Header row.
        Padding(
          padding: const EdgeInsets.only(bottom: NhamSpacing.sp2),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(tr('dashboard.recentMeals').toUpperCase(),
                  style: dashEyebrow()),
              Text(
                tr('dashboard.mealsLogged',
                    namedArgs: {'count': '${meals.length}'}),
                style: dashMeta(color: kInkDisabled),
              ),
            ],
          ),
        ),
        for (var i = 0; i < meals.length; i++) ...[
          if (i > 0) const SizedBox(height: NhamSpacing.sp2),
          _MealRow(index: i, meal: meals[i]),
        ],
      ],
    );
  }
}

class _MealRow extends StatelessWidget {
  const _MealRow({required this.index, required this.meal});
  final int index;
  final PersistedMeal meal;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      // Baseline-align the index, name and kcal so the row reads on one line;
      // index sits in an 18px column (left edge = content-left, like the macro
      // labels) and kcal in the shared right column (aligned with the macro
      // values).
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          SizedBox(
            width: 18,
            child: Text(
              '${index + 1}',
              style: dashMeta(color: kInkSecondary, tabular: true),
            ),
          ),
          const SizedBox(width: NhamSpacing.sp1),
          Expanded(
            child: Text(
              meal.rawInput,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: dashBody(),
            ),
          ),
          const SizedBox(width: NhamSpacing.sp2),
          SizedBox(
            width: _valueColumnWidth,
            child: Text(
              '${round0(meal.nutrition.caloriesKcal)}',
              textAlign: TextAlign.right,
              style: dashMeta(color: kInkSecondary, tabular: true),
            ),
          ),
        ],
      ),
    );
  }
}

/// motion.section initial {opacity:0,y:10} → {1,0} over 0.45s.
class _FadeInDown extends StatefulWidget {
  const _FadeInDown({required this.child});
  final Widget child;

  @override
  State<_FadeInDown> createState() => _FadeInDownState();
}

class _FadeInDownState extends State<_FadeInDown>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 450),
  )..forward();

  late final Animation<double> _opacity =
      CurvedAnimation(parent: _c, curve: Curves.easeOut);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _opacity,
      child: AnimatedBuilder(
        animation: _opacity,
        builder: (context, child) => Transform.translate(
          offset: Offset(0, 10 * (1 - _opacity.value)),
          child: child,
        ),
        child: widget.child,
      ),
    );
  }
}
