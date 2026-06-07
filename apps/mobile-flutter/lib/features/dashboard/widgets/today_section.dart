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

class TodaySection extends ConsumerWidget {
  const TodaySection({super.key, required this.args, required this.targets});

  final DashboardArgs args;
  final DockTargets targets;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(loggingDayProvider(args));
    return async.when(
      loading: () => SectionState(message: tr('dashboard.todayLoading')),
      error: (_, __) => SectionState(
        message: tr('dashboard.todayLoadError'),
        actionLabel: tr('dashboard.retry'),
        onAction: () => ref.invalidate(dashboardBundleProvider(args)),
      ),
      data: (day) => _Dock(day: day, targets: targets),
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
  const _Dock({required this.day, required this.targets});

  final LoggingDayData day;
  final DockTargets targets;

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
    final remaining = (targets.calorieTarget - calories)
        .clamp(0, double.infinity)
        .round();

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
            // (a) Calories-remaining hero — directly on white, no sub-block.
            Text(
              tr('dashboard.caloriesRemaining').toUpperCase(),
              style: dashEyebrow(),
            ),
            const SizedBox(height: NhamSpacing.sp1),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(_fmt(remaining), style: dashHero()),
                const SizedBox(width: 6),
                Text(
                  '/ ${_fmt(targets.calorieTarget.round())}',
                  style: dashBody(color: kInkSecondary),
                ),
              ],
            ),
            const SizedBox(height: NhamSpacing.sp1),
            Text(
              '${_fmt(calories)} ${tr('dashboard.caloriesLogged')}',
              style: dashMeta(color: kInkDisabled),
            ),

            const SizedBox(height: NhamSpacing.sp5),

            // (b) Ring + macros.
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                CalorieRing(
                  current: calories.toDouble(),
                  target: targets.calorieTarget,
                  size: 72,
                  strokeWidth: 6,
                  center: const Icon(LucideIcons.flame,
                      size: 20, color: kInk),
                ),
                const SizedBox(width: NhamSpacing.sp4),
                Expanded(
                  child: Column(
                    children: [
                      for (var i = 0; i < macroBars.length; i++) ...[
                        if (i > 0) const SizedBox(height: NhamSpacing.sp3),
                        _MacroRow(bar: macroBars[i], idx: i),
                      ],
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: NhamSpacing.sp5),

            // (c) Meal list — plain, on the card surface (no nested fill).
            meals.isEmpty ? _EmptyMeals() : _MealList(meals: meals),
          ],
        ),
      ),
    );
  }

  static String _fmt(int n) {
    // toLocaleString() → group thousands with commas (en default).
    final s = n.abs().toString();
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(',');
      buf.write(s[i]);
    }
    return n < 0 ? '-$buf' : buf.toString();
  }
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
        Text(
          '${bar.current}/${bar.target}g',
          style: dashMeta(color: kInk, tabular: true),
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
                width: constraints.maxWidth * (_fill.value / 100),
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
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
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
              ],
            ),
          ),
          const SizedBox(width: NhamSpacing.sp2),
          Text(
            '${round0(meal.nutrition.caloriesKcal)}',
            style: dashMeta(color: kInkSecondary, tabular: true),
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
