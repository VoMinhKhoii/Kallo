import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/plan_offer.dart';
import 'gold_surface.dart';
import 'paywall_consent.dart';
import 'plan_cta.dart';

/// Everything below the table, pinned to the bottom edge: the buy button, what
/// it will charge, the way out, and the obligations.
///
/// Pinned rather than scrolled because these four are the decision. The table
/// above may scroll past the fold on a small phone — it is evidence, and the
/// user can go looking for it — but the price, the renewal terms and the exit
/// are never something to scroll for.
///
/// Opaque canvas with a hairline top: the table ends at the band's edge
/// instead of running under it, so nothing but the canvas ever sits behind
/// the savings chip hanging off the button.
///
/// It takes the [offer] whole rather than the five strings inside it: those
/// five must agree with each other, and `plan_offer.dart` is where they are
/// made to.
class PaywallBuyBand extends StatelessWidget {
  const PaywallBuyBand({
    required this.offer,
    required this.onBuy,
    required this.onStayFree,
    this.loading = false,
    super.key,
  });

  final PaywallOffer offer;

  /// Null with the store closed or a purchase already in flight — the button
  /// goes dead, the rest of the band does not move.
  final VoidCallback? onBuy;
  final VoidCallback onStayFree;
  final bool loading;

  /// Above the button: the chip hangs [GoldPlanSurface.chipOverlap] over its
  /// top edge, and this keeps the whole chip inside the band, under the
  /// hairline, rather than poking out over the table.
  static const double topInset =
      GoldPlanSurface.chipOverlap + KalloSpacing.sp2_5;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: kPage,
        border: Border(top: BorderSide(color: kHairline)),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          KalloSpacing.sp5,
          topInset,
          KalloSpacing.sp5,
          // The band owns the bottom edge, so the home indicator is its inset.
          KalloSpacing.sp6 + MediaQuery.viewPaddingOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            PlanCta(
              label: offer.ctaLabel,
              chipLabel: offer.chipLabel,
              gold: offer.yearly,
              loading: loading,
              disabled: onBuy == null,
              onPressed: onBuy,
            ),
            // Empty on the store-closed face — no purchase, nothing to
            // disclose — and then it takes no room either.
            if (offer.renewalLine.isNotEmpty) ...[
              const SizedBox(height: KalloSpacing.sp1_5),
              Text(
                offer.renewalLine,
                style: dashCaption().copyWith(height: 1.35),
                textAlign: TextAlign.center,
              ),
            ],
            const SizedBox(height: KalloSpacing.sp2),
            // Secondary, not ghost: declining is a real choice and gets a real
            // button, which is also why the header no longer carries it as a
            // link. It is the only exit that reads as one from a thumb's reach.
            KalloButton(
              title: tr('paywall.stayFree'),
              variant: KalloButtonVariant.secondary,
              onPressed: onStayFree,
            ),
            const SizedBox(height: KalloSpacing.sp2),
            const PaywallConsent(),
          ],
        ),
      ),
    );
  }
}
