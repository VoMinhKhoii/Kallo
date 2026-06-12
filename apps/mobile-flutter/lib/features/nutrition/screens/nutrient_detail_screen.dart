import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../features/dashboard/widgets/dashboard_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../shared/widgets/target_progress_bar.dart';
import '../logic/helpers.dart';
import '../providers/food_candidates_provider.dart';
import '../widgets/food_candidate_row.dart';
import '../widgets/nutrient_sparkline.dart';

/// The real nutrient detail route — pushed (Cupertino swipe-back) from a steady
/// / background nutrient row. Replaces the old inline "tap reveals a duplicate
/// bar" expand.
///
/// Three bands, all re-tokened on `dashboard_tokens` (solid cards, one radius,
/// 5-size DM Sans, three inks):
///   1. The point figure + target progress (point value only — no ranges or
///      confidence, per founder direction).
///   2. A coverage sparkline degrading to dots when coverage is thin.
///   3. Food candidates as FULL rows — name, serving, rationale, caution — the
///      content the overview screen renders as name-only pills.
class NutrientDetailScreen extends ConsumerWidget {
  const NutrientDetailScreen({super.key, required this.card});

  final NutrientCardData card;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = context.locale.languageCode;
    final label = tr(card.labelKey);
    final hasTarget = card.percentOfTarget != null;
    final percent = card.percentOfTarget ?? 0;
    final showExceed = shouldShowExceed(card.nutrientType, card.percentOfTarget);
    final limited =
        card.displayState == ConfidenceDisplayState.limitedData ||
            card.displayState == ConfidenceDisplayState.insufficientData;

    // The point figure: today's resolved average, the single trustworthy number.
    final figure = card.averagePerDay == null
        ? '—'
        : formatLocalizedNumber(card.averagePerDay!, locale);

    return CupertinoPageScaffold(
      backgroundColor: kPage,
      navigationBar: CupertinoNavigationBar(
        backgroundColor: kPage,
        border: const Border(bottom: BorderSide(color: kHairline, width: 0.5)),
        middle: Text(label, style: dashBody(weight: FontWeight.w600)),
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 80),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Band 1: the figure + target progress ──────────────────
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: kCardSurface,
                  borderRadius: BorderRadius.circular(kCardRadius),
                  boxShadow: const [kCardShadow],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(figure, style: dashHero()),
                        const SizedBox(width: 6),
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Text(card.unit, style: dashMeta()),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    // Meta, not an eyebrow — the screen keeps max two eyebrows
                    // (the sparkline + candidates section labels).
                    Text(
                      tr('nutrition.rhythm.avgPerLoggedDay'),
                      style: dashMeta(color: kInkSecondary),
                    ),
                    if (hasTarget) ...[
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          Expanded(
                            child: TargetProgressBar(
                              percentOfTarget: card.percentOfTarget,
                              showExceed: showExceed,
                              duration: const Duration(milliseconds: 550),
                              semanticLabel: tr(
                                'nutrition.focus.spotlightBarAria',
                                namedArgs: {
                                  'label': label,
                                  'pct': percent.round().toString(),
                                },
                              ),
                            ),
                          ),
                          if (card.target != null) ...[
                            const SizedBox(width: 12),
                            Text(
                              '${formatLocalizedNumber(card.target!, locale)} ${card.unit}',
                              style: dashMeta(tabular: true),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ],
                ),
              ),

              // ── Band 2: the average against target ───────────────────
              // We hold one resolved average, not a per-day series — when
              // there's nothing meaningful to plot (no target, or limited
              // data) the band is omitted entirely; the candidate rows carry
              // the screen.
              if (_coveragePoints(card, limited).isNotEmpty) ...[
                const SizedBox(height: 24),
                Text(tr('nutrition.detail.averageVsTarget').toUpperCase(),
                    style: dashEyebrow()),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: kCardSurface,
                    borderRadius: BorderRadius.circular(kCardRadius),
                    boxShadow: const [kCardShadow],
                  ),
                  child: NutrientSparkline(
                    points: _coveragePoints(card, limited),
                    semanticLabel: tr('nutrition.trend.chartLabel'),
                  ),
                ),
              ],

              // ── Band 3: food candidates as full rows ──────────────────
              if (card.supportsCandidates) ...[
                const SizedBox(height: 24),
                Text(tr('nutrition.candidates.title').toUpperCase(),
                    style: dashEyebrow()),
                const SizedBox(height: 6),
                Text(
                  tr('nutrition.candidates.description'),
                  style: dashMeta(color: kInkSecondary),
                ),
                const SizedBox(height: 12),
                _FoodCandidates(nutrient: card.nutrient),
              ],
            ],
          ),
        ),
      ),
    );
  }

  /// Points for the sparkline. We hold a single resolved average, not a
  /// per-day series, so at most one point exists — the average normalized
  /// against the target. No target (nothing to normalize against) or
  /// limited/insufficient data → empty, and the band isn't rendered. Never a
  /// fabricated midpoint.
  List<double> _coveragePoints(NutrientCardData card, bool limited) {
    if (limited || card.averagePerDay == null) return const [];
    final target = card.target;
    if (target == null || target <= 0) return const [];
    return [(card.averagePerDay! / target).clamp(0.0, 1.0)];
  }
}

/// The candidate query, rendered as full rows (loading / error / empty / data).
class _FoodCandidates extends ConsumerWidget {
  const _FoodCandidates({required this.nutrient});

  final NutritionNutrientKey nutrient;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(foodCandidatesProvider(nutrient));

    return async.when(
      loading: () => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text(tr('nutrition.candidates.loading'), style: dashMeta()),
      ),
      error: (_, __) => _ErrorLine(
        message: tr('nutrition.candidates.error'),
        retryLabel: tr('nutrition.candidates.retry'),
        onRetry: () => ref.invalidate(foodCandidatesProvider(nutrient)),
      ),
      data: (response) {
        final candidates = response?.candidates ?? const [];
        if (candidates.isEmpty) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(tr('nutrition.candidates.empty'), style: dashMeta()),
          );
        }
        return Column(
          children: [
            for (var i = 0; i < candidates.length; i++) ...[
              if (i > 0) const SizedBox(height: 12),
              FoodCandidateRow(candidate: candidates[i]),
            ],
          ],
        );
      },
    );
  }
}

class _ErrorLine extends StatelessWidget {
  const _ErrorLine({
    required this.message,
    required this.retryLabel,
    required this.onRetry,
  });

  final String message;
  final String retryLabel;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(message, style: dashMeta(color: kInkSecondary)),
        ),
        const SizedBox(width: 12),
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onRetry,
          child: Text(retryLabel, style: dashMeta(color: kInk)),
        ),
      ],
    );
  }
}
