/// WeightChart — the dashboard's weight-trend card.
///
/// Apple-Health style: a clean data surface — the current weight as the hero
/// number with a net-change figure beside it, and a full-width line chart
/// ([WeightChartCanvas]). The card carries NO log affordance: weigh-ins go
/// through the tab bar's "+" Add sheet (native pass, 2026-08-31), which opens
/// the same `showWeightLogSheet` form.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/profile/weight.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/dashboard_providers.dart';
import '../../logic/dashboard_spacing.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../shared/widgets/feedback/skeleton.dart';
import '../states/card_skeletons.dart';
import 'weight_chart_canvas.dart';

class WeightChart extends ConsumerWidget {
  const WeightChart({super.key, required this.args});

  final DashboardArgs args;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(weightSummaryProvider(args));

    return KalloCard(
      padding: DashboardSpacing.card,
      child: async.when(
        // A weigh-in invalidates the bundle, so weightSummaryProvider goes
        // isReloading and .when would flash the skeleton back over a card that
        // already has data — skipLoadingOnReload only defaults true on refresh.
        skipLoadingOnReload: true,
        // Skeleton of the card body (no spinner) — the card is already drawn,
        // so only its inner rows shimmer.
        loading: () => SkeletonPulse(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: weightCardSkeletonChildren(),
          ),
        ),
        error: (_, __) => Container(
          constraints: const BoxConstraints(minHeight: 200),
          alignment: Alignment.center,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                LucideIcons.cloudOff300,
                size: KalloIcons.size,
                color: kInkMuted,
              ),
              const SizedBox(height: KalloSpacing.sp2),
              Text(
                tr('dashboard.progressLoadError'),
                textAlign: TextAlign.center,
                style: dashMeta(color: kInkMuted),
              ),
            ],
          ),
        ),
        data: (data) => _Body(data: data),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.data});

  final WeightSummaryData data;

  @override
  Widget build(BuildContext context) {
    final kg = tr('dashboard.units.kg');

    // Nothing LOGGED yet: the empty state and nothing else.
    //
    // `currentWeight` is non-null from the onboarding profile even when the
    // user has never weighed in, so the card used to headline "65.9 kg" over
    // the words "Log your first weight to start tracking your trend" — a
    // number and a denial that there is one, on the same card. The profile
    // weight still prefills the log sheet; it just isn't a reading.
    if (data.weights.isEmpty) {
      return Container(
        constraints: const BoxConstraints(minHeight: 200),
        alignment: Alignment.center,
        child: Text(
          tr('dashboard.noWeightData'),
          textAlign: TextAlign.center,
          style: dashMeta(color: kInkMuted),
        ),
      );
    }

    // Net change over the window (current − period start), shown as a small
    // badge right beside the hero number.
    final delta = data.currentWeight - data.periodStartWeight;
    final hasTrend = data.weights.length > 1 && delta.abs() >= 0.05;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Hero — current weight, its unit and the net change, all on one
        // baseline. No log affordance: the tab bar's "+" owns that now.
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(data.currentWeight.toStringAsFixed(1), style: dashHero()),
            const SizedBox(width: 6),
            Text(kg, style: dashBody(color: kInkMuted)),
            if (hasTrend) ...[
              const SizedBox(width: KalloSpacing.sp2),
              _TrendBadge(delta: delta),
            ],
          ],
        ),
        const SizedBox(height: KalloSpacing.sp4),

        WeightChartCanvas(
          weights: data.weights,
          weightDates: data.weightDates,
          periodElapsedDays: data.periodElapsedDays,
          projectedEndWeight: data.projectedEndWeight,
          canProject: data.canProject,
        ),
      ],
    );
  }
}

/// The net change beside the hero weight, e.g. "↓ 1.2". A text arrow, not an
/// icon, so it sits on the hero number's baseline; 14/500 muted — a figure that
/// qualifies the hero rather than competing with it. Only rendered when there's
/// a real trend (the caller guards on it).
class _TrendBadge extends StatelessWidget {
  const _TrendBadge({required this.delta});

  final double delta;

  @override
  Widget build(BuildContext context) {
    final arrow = delta > 0 ? '↑' : '↓';
    return Text(
      '$arrow ${delta.abs().toStringAsFixed(1)}',
      style: dashBody(
        color: kInkMuted,
        tabular: true,
      ),
    );
  }
}
