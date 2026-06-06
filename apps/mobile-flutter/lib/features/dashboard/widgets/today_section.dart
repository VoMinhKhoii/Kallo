/// TodaySection — RN port of the dashboard's TodayDock-equivalent
/// (`dashboard.tsx` `TodaySection`). The reused [CalorieRing] (with a flame
/// center), the macro bars, the "Calories remaining" hero block, and the meal
/// list. Reads today's persisted meals off the dashboard bundle.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/widgets.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
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
        padding: const EdgeInsets.all(NhamSpacing.sp3),
        decoration: BoxDecoration(
          color: kCard90, // bg-card/90
          borderRadius:
              BorderRadius.circular(kCardRadius24), // rounded-[1.5rem]
          border: Border.all(color: kBorder70), // border-nham-border/70
          boxShadow: const [kCardShadow], // shadow-[0_10px_32px_…/0.05]
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // (a) Calories remaining hero.
            _CreamBlock(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  NhamText(
                    tr('dashboard.caloriesRemaining'),
                    variant: NhamTextVariant.eyebrow,
                    style: const TextStyle(color: NhamColors.stone),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: NhamSpacing.sp1),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          _fmt(remaining),
                          style:
                              NhamTextStyles.serifSemiBold(fontSize: 36, height: 1)
                                  .copyWith(
                            letterSpacing: -1.44, // tracking-[-0.04em] @ 36px
                            color: NhamColors.text,
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '/ ${_fmt(targets.calorieTarget.round())}',
                          style: NhamTextStyles.serifItalic(
                                  fontSize: NhamFontSize.lg)
                              .copyWith(color: NhamColors.textMuted),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: NhamSpacing.sp1),
                    child: Text(
                      '${_fmt(calories)} ${tr('dashboard.caloriesLogged')}',
                      style:
                          NhamTextStyles.sansRegular(fontSize: NhamFontSize.xs)
                              .copyWith(color: NhamColors.stone),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: NhamSpacing.sp3),

            // (b) Ring + macros.
            _CreamBlock(
              color: kSurface60, // bg-nham-surface/60
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  CalorieRing(
                    current: calories.toDouble(),
                    target: targets.calorieTarget,
                    size: 72,
                    strokeWidth: 6,
                    center: const Icon(Icons.local_fire_department_outlined,
                        size: 24, color: NhamColors.accent),
                  ),
                  const SizedBox(width: NhamSpacing.sp3),
                  Expanded(
                    child: Column(
                      children: [
                        for (var i = 0; i < macroBars.length; i++) ...[
                          if (i > 0) const SizedBox(height: 14), // gap-3.5
                          _MacroRow(bar: macroBars[i], idx: i),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: NhamSpacing.sp3),

            // (c) Meal list.
            Container(
              constraints: const BoxConstraints(minHeight: 140),
              padding: const EdgeInsets.all(10), // p-2.5
              decoration: BoxDecoration(
                color: kSurface60, // bg-nham-surface/60
                borderRadius:
                    BorderRadius.circular(kBlockRadius20), // rounded-[1.25rem]
                border: Border.all(color: NhamColors.borderSoft), // /60
              ),
              child: meals.isEmpty
                  ? _EmptyMeals()
                  : _MealList(meals: meals),
            ),
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

class _CreamBlock extends StatelessWidget {
  const _CreamBlock({required this.child, this.color = NhamColors.surface80});
  final Widget child;

  /// `bg-nham-surface/80` (hero) or `bg-nham-surface/60` (ring+macros).
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp3),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(kBlockRadius20), // rounded-[1.25rem]
      ),
      child: child,
    );
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
          width: 48,
          child: Text(
            bar.label.toUpperCase(),
            maxLines: 1,
            // w-12 font-bold text-[9px] stone uppercase tracking-widest(0.9px).
            style: NhamTextStyles.sansBold(fontSize: 9)
                .copyWith(letterSpacing: 0.9, color: NhamColors.stone),
          ),
        ),
        const SizedBox(width: NhamSpacing.sp3),
        Expanded(child: _MacroBar(pct: pct, color: bar.color, idx: idx)),
        const SizedBox(width: NhamSpacing.sp3),
        SizedBox(
          width: 52,
          // w-[52px] text-right font-mono text-[10px] stone tabular-nums.
          child: Text(
            '${bar.current}/${bar.target}g',
            textAlign: TextAlign.right,
            style: dashMono(fontSize: 10).copyWith(color: NhamColors.stone),
          ),
        ),
      ],
    );
  }
}

/// One macro bar fill: h-1.5 (6px) track, fill animates 0 → pct over 900ms with
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
        height: 6, // h-1.5
        color: NhamColors.track,
        child: LayoutBuilder(
          builder: (context, constraints) => AnimatedBuilder(
            animation: _fill,
            builder: (context, _) => Align(
              alignment: Alignment.centerLeft,
              child: Container(
                width: constraints.maxWidth * (_fill.value / 100),
                height: 6,
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

/// Empty state — a DASHED-border card:
/// `border border-nham-border/60 border-dashed bg-card/40 rounded-2xl px-3 py-3`,
/// centered, gap-1.5.
class _EmptyMeals extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 116),
      child: CustomPaint(
        painter: _DashedBorderPainter(
          color: NhamColors.borderSoft, // /60
          radius: NhamRadii.containerLg, // rounded-2xl(16)
        ),
        child: Container(
          decoration: BoxDecoration(
            color: kCard40, // bg-card/40
            borderRadius: BorderRadius.circular(NhamRadii.containerLg),
          ),
          padding: const EdgeInsets.symmetric(
              horizontal: NhamSpacing.sp3, vertical: NhamSpacing.sp3),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                tr('dashboard.noMealsToday'),
                textAlign: TextAlign.center,
                style: NhamTextStyles.sansSemiBold(fontSize: NhamFontSize.sm)
                    .copyWith(color: NhamColors.text),
              ),
              const SizedBox(height: 6), // gap-1.5
              Text(
                tr('dashboard.mealReceiptsHint'),
                textAlign: TextAlign.center,
                style: NhamTextStyles.sansRegular(fontSize: 11)
                    .copyWith(color: NhamColors.stone),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Paints a dashed rounded-rect stroke (Tailwind `border-dashed`, ~1px).
class _DashedBorderPainter extends CustomPainter {
  _DashedBorderPainter({required this.color, required this.radius});
  final Color color;
  final double radius;

  static const double _dash = 4;
  static const double _gap = 3;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rrect);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = color;

    for (final metric in path.computeMetrics()) {
      var dist = 0.0;
      while (dist < metric.length) {
        final next = dist + _dash;
        canvas.drawPath(
          metric.extractPath(dist, next.clamp(0, metric.length)),
          paint,
        );
        dist = next + _gap;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorderPainter old) =>
      old.color != color || old.radius != radius;
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
              NhamText(
                tr('dashboard.recentMeals'),
                variant: NhamTextVariant.eyebrow,
                // text-[9px] tracking-[0.15em] (= 1.35px @ 9px).
                style: const TextStyle(fontSize: 9, letterSpacing: 1.35),
              ),
              Text(
                tr('dashboard.mealsLogged',
                    namedArgs: {'count': '${meals.length}'}),
                style: NhamTextStyles.sansRegular(fontSize: 9)
                    .copyWith(color: NhamColors.stone),
              ),
            ],
          ),
        ),
        for (var i = 0; i < meals.length; i++) ...[
          if (i > 0) const SizedBox(height: 6), // gap-1.5
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
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 2), // mt-0.5
                  child: Text(
                    '${index + 1}',
                    style: NhamTextStyles.serifRegular(
                            fontSize: NhamFontSize.eyebrow, height: 1)
                        .copyWith(
                      color: NhamColors.accent,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
                const SizedBox(width: NhamSpacing.sp2),
                Expanded(
                  child: Text(
                    meal.rawInput,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    // leading-tight = 1.25.
                    style: NhamTextStyles.sansRegular(fontSize: 11, height: 1.25)
                        .copyWith(color: NhamColors.text),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: NhamSpacing.sp2),
          // font-mono text-[10px] stone tabular-nums.
          Text(
            '${round0(meal.nutrition.caloriesKcal)}',
            style: dashMono(fontSize: 10).copyWith(color: NhamColors.stone),
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
