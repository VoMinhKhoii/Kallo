import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/paywall_controller.dart';
import 'gold_cta.dart';
import 'paywall_sheet_actions.dart';

/// Everything below the table, pinned to the bottom edge: the buy button, what
/// it will charge, the way out, and the obligations.
///
/// Pinned rather than scrolled because these four are the decision. The table
/// above may scroll past the fold on a small phone — it is evidence, and the
/// user can go looking for it — but the price, the renewal terms and the exit
/// are never something to scroll for.
class PaywallBuyBand extends StatelessWidget {
  const PaywallBuyBand({
    required this.state,
    required this.label,
    required this.renewalLine,
    required this.yearly,
    required this.onBuy,
    required this.onStayFree,
    this.chipLabel,
    this.loading = false,
    this.disabled = false,
    super.key,
  });

  final PaywallState state;

  /// The buy button's label and its optional savings chip.
  final String label;
  final String? chipLabel;

  /// "Auto-renews at … until cancelled." — never hidden, never behind a
  /// toggle (see `plan_promise.dart`).
  final String renewalLine;

  /// Gold for the yearly plan, the app's ordinary ink CTA for the monthly one.
  /// The gold marks the DEAL: putting it on both would make it decoration.
  final bool yearly;

  final VoidCallback? onBuy;
  final VoidCallback onStayFree;
  final bool loading;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        KalloSpacing.sp5,
        KalloSpacing.sp3_5,
        KalloSpacing.sp5,
        // The band owns the bottom edge, so the home indicator is its inset.
        KalloSpacing.sp6 + MediaQuery.viewPaddingOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buy(),
          const SizedBox(height: KalloSpacing.sp1_5),
          Text(
            renewalLine,
            style: dashCaption().copyWith(height: 1.35),
            textAlign: TextAlign.center,
          ),
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
          // 11, one step under the caption tier: this is the fine print, and
          // at 12 the Vietnamese sentence takes a third line off the table
          // above it. The three things it names are TAPPABLE on the row below
          // — the sentence is the acknowledgement, not the affordance.
          Text(
            tr('paywall.consent'),
            style: dashCaption().copyWith(fontSize: 11, height: 1.35),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: KalloSpacing.sp1_5),
          PaywallSheetActions(state: state),
        ],
      ),
    );
  }

  Widget _buy() {
    if (yearly) {
      return GoldCta(
        label: label,
        chipLabel: chipLabel,
        loading: loading,
        disabled: disabled,
        onPressed: onBuy,
      );
    }
    return KalloButton(
      title: label,
      variant: KalloButtonVariant.cta,
      loading: loading,
      disabled: disabled,
      onPressed: onBuy,
    );
  }
}
