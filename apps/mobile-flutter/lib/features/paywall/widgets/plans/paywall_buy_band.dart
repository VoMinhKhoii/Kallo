import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/plan_offer.dart';
import '../paywall_gutter.dart';
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
/// In a short, wide window it is one side of the screen instead (see
/// `PaywallSplit`): it carries the title and the toggle as its [head] and
/// centres on the window's height beside the table.
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
    this.welcome,
    this.head,
    this.opaque = true,
    super.key,
  });

  final PaywallOffer offer;

  /// Null with the store closed or a purchase already in flight — the button
  /// goes dead, the rest of the band does not move.
  final VoidCallback? onBuy;
  final VoidCallback onStayFree;
  final bool loading;

  /// The end of onboarding for a user already on the complimentary welcome
  /// grant. Premium is theirs for these days, so the main button starts it
  /// (no charge, same exit as [onStayFree]) and buying now steps down to the
  /// secondary button. Null on every other face.
  final PaywallWelcome? welcome;

  /// Beside the table, what stands over the button: the title and the period
  /// toggle, which a single column keeps above the table instead.
  final Widget? head;
  final bool opaque;

  /// Above the button: the chip hangs [GoldPlanSurface.chipOverlap] over its
  /// top edge, and this keeps the whole chip inside the band, under the
  /// hairline, rather than poking out over the table.
  static const double topInset =
      GoldPlanSurface.chipOverlap + KalloSpacing.sp2_5;

  @override
  Widget build(BuildContext context) {
    final welcome = this.welcome;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: opaque ? kPage : null,
        border: opaque ? Border(top: BorderSide(color: kHairline)) : null,
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          // The column's own gutter, so the buttons share the table's edges.
          PaywallGutter.of(context) + MediaQuery.viewPaddingOf(context).left,
          topInset,
          PaywallGutter.of(context) + MediaQuery.viewPaddingOf(context).right,
          // The band owns the bottom edge, so the home indicator is its inset.
          KalloSpacing.sp6 + MediaQuery.viewPaddingOf(context).bottom,
        ),
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (head != null) ...[
                  head!,
                  const SizedBox(height: KalloSpacing.sp4),
                ],
                if (welcome != null) ...[
                  // Today's band, same shape and height: only the words change.
                  PlanCta(
                    label: tr(
                      'paywall.welcomeStart',
                      namedArgs: {'days': '${welcome.days}'},
                    ),
                    gold: offer.yearly,
                    onPressed: onStayFree,
                  ),
                  const SizedBox(height: KalloSpacing.sp1_5),
                  Text(
                    tr(
                      'paywall.welcomeUntil',
                      namedArgs: {'date': welcome.until},
                    ),
                    style: dashCaption().copyWith(height: 1.35),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: KalloSpacing.sp2),
                  // Buying is still on offer; the price rides on its own button
                  // so the band keeps today's height.
                  KalloButton(
                    title: _subscribeLabel(),
                    variant: KalloButtonVariant.secondary,
                    loading: loading,
                    onPressed: onBuy,
                  ),
                  const SizedBox(height: KalloSpacing.sp2),
                  const PaywallConsent(),
                ] else ...[
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
              ],
            ),
          ),
        ),
      ),
    );
  }
}

extension on PaywallBuyBand {
  String _subscribeLabel() {
    final plan = offer.plan;
    if (plan == null) return tr('paywall.welcomeSubscribe');
    final period = tr(offer.yearly ? 'paywall.perYear' : 'paywall.perMonth');
    return tr(
      'paywall.welcomeSubscribePrice',
      namedArgs: {'price': '${plan.storeProduct.priceString}$period'},
    );
  }
}

/// What the welcome face says: how many complimentary days are left and the
/// date they end, already formatted for the locale.
class PaywallWelcome {
  const PaywallWelcome({required this.days, required this.until});

  final int days;
  final String until;
}
