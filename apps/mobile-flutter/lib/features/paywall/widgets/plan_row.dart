import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import '../../../shared/widgets/form/option/option_row_shell.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_motion.dart';
import '../../../theme/kallo_theme.dart';
import '../logic/plan_pricing.dart';
import 'plan_row_gold.dart';

/// One plan in the Kallo Pro sheet: a radio, the plan name over a subline, and
/// the store price with its period under it.
///
/// It wears the shared [OptionRowShell] anatomy but not its selection border:
/// [gold] rows keep their own 1px gold edge in both states, because a 2px ink
/// border over the gradient reads as damage rather than as a choice. On gold
/// the radio IS the selection mark.
class PlanRow extends StatelessWidget {
  const PlanRow({
    super.key,
    required this.name,
    required this.price,
    required this.period,
    required this.selected,
    required this.onTap,
    this.subline,
    this.struckSubline,
    this.chipLabel,
    this.gold = false,
    this.enabled = true,
  });

  /// The store's own strings, dressed as a row: the yearly one gold, with the
  /// derived strike / per-month / save copy read off [monthly]. No locale is
  /// passed to the arithmetic — the derived figures follow the DEVICE locale
  /// the store priced in, so all three numbers are formatted the same way.
  factory PlanRow.forPackage(
    Package plan, {
    required Package? monthly,
    required bool selected,
    required bool enabled,
    required VoidCallback onTap,
  }) {
    final annual = plan.packageType == PackageType.annual;
    final pricing = annual ? yearlyPricing(annual: plan, monthly: monthly) : null;
    final save = pricing?.savePercent;
    return PlanRow(
      name: tr(annual ? 'paywall.planYearly' : 'paywall.packageMonthly'),
      price: plan.storeProduct.priceString,
      period: tr(annual ? 'paywall.perYearLabel' : 'paywall.perMonthLabel'),
      subline: pricing == null
          ? tr('paywall.planSublineMonthly')
          : tr('paywall.priceAMonth', namedArgs: {'price': pricing.perMonth}),
      struckSubline: pricing?.struckYearly,
      chipLabel: save == null
          ? null
          : tr('paywall.bestValueSave', namedArgs: {'percent': '$save'}),
      gold: annual,
      selected: selected,
      enabled: enabled,
      onTap: onTap,
    );
  }

  final String name;

  /// The store's own formatted price string — never re-derived.
  final String price;

  /// "per year" / "per month", set under the price.
  final String period;

  /// The quiet line under the name ("Cancel anytime", "· $2.08 a month").
  final String? subline;

  /// Twelve monthly payments, struck, ahead of [subline]. Absent when it
  /// cannot be computed from the offering.
  final String? struckSubline;

  /// "Best value · save 40%" — the ink chip overlapping the top-right edge.
  final String? chipLabel;

  final bool gold;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  static const double radius = 16;

  Color get _mutedInk => gold ? kGoldMuted : kInkMuted;

  @override
  Widget build(BuildContext context) {
    final double border = gold || !selected ? 1 : 2;
    return OptionRowShell(
      selected: selected,
      enabled: enabled,
      onTap: onTap,
      border: border,
      insetVertically: true,
      radioIdleColor: gold ? kGoldMuted : KalloColors.border,
      semanticsLabel: [name, subline, '$price $period', chipLabel]
          .whereType<String>()
          .join(', '),
      surface: (context, pressed, body) => gold
          ? GoldPlanSurface(radius: radius, chipLabel: chipLabel, child: body)
          : AnimatedContainer(
              duration: KalloMotion.press,
              curve: KalloEase.press,
              decoration: BoxDecoration(
                color: kCardSurface,
                borderRadius: BorderRadius.circular(radius),
                border: Border.all(
                  color: selected ? kInk : KalloColors.border,
                  width: border,
                ),
                boxShadow: selected ? kCardShadows : null,
              ),
              child: body,
            ),
      children: [
        Expanded(child: _text()),
        const SizedBox(width: KalloSpacing.sp2),
        _price(context),
      ],
    );
  }

  Widget _text() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: dashBody()),
          if (subline != null || struckSubline != null) ...[
            const SizedBox(height: 2),
            _subline(),
          ],
        ],
      );

  Widget _subline() => Text.rich(
        TextSpan(
          children: [
            if (struckSubline != null) ...[
              TextSpan(
                text: struckSubline,
                style: dashMeta(color: _mutedInk).copyWith(
                  decoration: TextDecoration.lineThrough,
                  decorationColor: _mutedInk,
                ),
              ),
              const TextSpan(text: ' · '),
            ],
            if (subline != null) TextSpan(text: subline),
          ],
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: dashMeta(color: _mutedInk),
      );

  /// The price column is NOT flexible — it has to stay flush right — so it
  /// carries its own ceiling instead, scaled with the user's text size. Without
  /// one, a long localized period word ("mỗi tháng" at 200% text) grows past
  /// the row and overflows the [Row] rather than ellipsizing.
  Widget _price(BuildContext context) => ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.textScalerOf(context).scale(120),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(price, maxLines: 1, overflow: TextOverflow.ellipsis, style: dashValue()),
            const SizedBox(height: 2),
            Text(
              period,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: dashMeta(color: _mutedInk),
            ),
          ],
        ),
      );
}
