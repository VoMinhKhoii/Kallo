/// WeightChart — the dashboard's weight-trend card.
///
/// 2026 redesign (Apple Health style): the card is a clean data surface — the
/// current weight as the bold hero number with a small net-change badge beside
/// it, and a full-width line chart ([WeightChartCanvas]). Logging lives in a
/// focused bottom sheet opened by a "Log" button (no resident form).
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../models/weight.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../data/dashboard_providers.dart';
import 'compact_weight_log.dart';
import 'dashboard_tokens.dart';
import 'skeleton.dart';
import 'weight_chart_canvas.dart';

class WeightChart extends ConsumerWidget {
  const WeightChart({super.key, required this.todayDate, required this.args});

  final String todayDate;
  final DashboardArgs args;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(weightSummaryProvider(args));

    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp4),
      decoration: BoxDecoration(
        color: kCardSurface, // solid white
        borderRadius: BorderRadius.circular(kCardRadius),
        boxShadow: kCardShadows, // shadow only, no border
      ),
      child: async.when(
        // Skeleton of the card body (no spinner) — the card is already drawn,
        // so only its inner rows shimmer.
        loading: () => Shimmer(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: weightCardSkeletonChildren(),
          ),
        ),
        error: (_, __) => _MinHeight(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(LucideIcons.cloudOff, size: 22, color: NhamColors.stone),
              const SizedBox(height: NhamSpacing.sp2),
              Text(
                tr('dashboard.progressLoadError'),
                textAlign: TextAlign.center,
                style: dashMeta(color: kInkSecondary),
              ),
            ],
          ),
        ),
        data: (data) => _Body(data: data, todayDate: todayDate, args: args),
      ),
    );
  }
}

class _MinHeight extends StatelessWidget {
  const _MinHeight({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
        constraints: const BoxConstraints(minHeight: 200),
        alignment: Alignment.center,
        child: child,
      );
}

class _Body extends StatelessWidget {
  const _Body({
    required this.data,
    required this.todayDate,
    required this.args,
  });

  final WeightSummaryData data;
  final String todayDate;
  final DashboardArgs args;

  @override
  Widget build(BuildContext context) {
    final kg = tr('dashboard.units.kg');

    // Net change over the window (current − period start), shown as a small
    // badge right beside the hero number.
    final delta = data.currentWeight - data.periodStartWeight;
    final hasTrend = data.weights.length > 1 && delta.abs() >= 0.05;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Hero — current weight + a small net-change badge, and a "Log weight"
        // button. The card stays a clean data surface; logging lives in a
        // focused sheet (Apple Health style), not a resident form.
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(data.currentWeight.toStringAsFixed(1),
                      style: dashHero()),
                  const SizedBox(width: 6),
                  Text(kg, style: dashBody(color: kInkSecondary)),
                  if (hasTrend) ...[
                    const SizedBox(width: NhamSpacing.sp2),
                    _TrendBadge(delta: delta),
                  ],
                ],
              ),
            ),
            const SizedBox(width: NhamSpacing.sp2),
            _LogButton(
              onTap: () => _openLogSheet(context, data, todayDate, args),
            ),
          ],
        ),
        const SizedBox(height: NhamSpacing.sp4),

        WeightChartCanvas(
          weights: data.weights,
          periodElapsedDays: data.periodElapsedDays,
          projectedEndWeight: data.projectedEndWeight,
          canProject: data.canProject,
        ),
      ],
    );
  }
}

/// A small net-change badge shown beside the hero weight, e.g. "↑ 3.0". Uses a
/// text arrow (not an icon) so it sits on the hero number's baseline. Only
/// rendered when there's a real trend (the caller guards on it).
class _TrendBadge extends StatelessWidget {
  const _TrendBadge({required this.delta});

  final double delta;

  @override
  Widget build(BuildContext context) {
    final arrow = delta > 0 ? '↑' : '↓';
    return Text(
      '$arrow ${delta.abs().toStringAsFixed(1)}',
      style: dashBody(
        color: kInkSecondary,
        weight: FontWeight.w600,
        tabular: true,
      ),
    );
  }
}

/// The card's log affordance — a filled accent "Log weight" pill (icon + label)
/// so the action is unmistakable. 44pt tall (iOS HIG) with a soft shadow and an
/// accessibility label.
class _LogButton extends StatelessWidget {
  const _LogButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(NhamRadii.xl);
    return Semantics(
      button: true,
      label: tr('dashboard.weightCard.logWeight'),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: radius,
          boxShadow: [
            BoxShadow(
              color: NhamColors.accent.withValues(alpha: 0.3),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Material(
          color: NhamColors.accent,
          borderRadius: radius,
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: Container(
              constraints: const BoxConstraints(minHeight: 40),
              padding: const EdgeInsets.symmetric(
                horizontal: NhamSpacing.sp3,
                vertical: NhamSpacing.sp2,
              ),
              alignment: Alignment.center,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(LucideIcons.plus, size: 16, color: Colors.white),
                  const SizedBox(width: 5),
                  Text(
                    tr('dashboard.weightCard.logWeight'),
                    style:
                        dashBody(color: Colors.white, weight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Opens the focused "log today's weight" bottom sheet — a keypad-first form
/// where a prominent field + Save button is the right call (unlike in the card).
void _openLogSheet(
  BuildContext context,
  WeightSummaryData data,
  String todayDate,
  DashboardArgs args,
) {
  HapticFeedback.lightImpact(); // open cue, matching the meal trigger
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: kCardSurface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(kCardRadius)),
    ),
    builder: (sheetContext) {
      final mq = MediaQuery.of(sheetContext);
      // A tall sheet — cap to the space above the keyboard — with the field +
      // Save bottom-aligned so they sit right above the number keypad (which
      // the viewInsets padding already lifts the sheet clear of), with only a
      // small breathing gap below.
      final available = mq.size.height - mq.viewInsets.bottom;
      final target = mq.size.height * 0.68;
      final sheetHeight = target < available ? target : available;
      return Padding(
        padding: EdgeInsets.only(bottom: mq.viewInsets.bottom),
        // Scroll-safe bottom-alignment: the top Spacer pushes the content to the
        // bottom (just above the keypad) when it fits, and
        // ConstrainedBox+IntrinsicHeight let the whole thing scroll instead of
        // overflowing when the height is tight (landscape, split-screen).
        child: SingleChildScrollView(
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: sheetHeight),
            child: IntrinsicHeight(
              child: Column(
                children: [
                  Container(
                    width: 36,
                    height: 4,
                    margin: const EdgeInsets.only(top: NhamSpacing.sp3),
                    decoration: BoxDecoration(
                      color: NhamColors.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const Spacer(),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: NhamSpacing.sp5,
                    ),
                    child: CompactWeightLog(
                      currentWeight: data.currentWeight,
                      todayWeight: data.todayWeight,
                      todayDate: todayDate,
                      args: args,
                      autofocus: true,
                      onSaved: () => Navigator.of(sheetContext).pop(),
                    ),
                  ),
                  const SizedBox(height: NhamSpacing.sp4),
                ],
              ),
            ),
          ),
        ),
      );
    },
  );
}
