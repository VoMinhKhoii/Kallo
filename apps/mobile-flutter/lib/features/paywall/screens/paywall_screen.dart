import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/billing/entitlement_state.dart';
import '../../../services/billing/entitlements_provider.dart';
import '../../../shell/nav/nav_actions.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../onboarding/widgets/backdrop/start_aurora.dart';
import '../data/paywall_controller.dart';
import '../widgets/chrome/paywall_header.dart';
import '../widgets/plans/paywall_purchase_face.dart';
import '../widgets/states/paywall_premium_body.dart';
import '../widgets/states/paywall_status.dart';

/// Kallo Pro. Free and lapsed users get the plan decision — the bun's line,
/// the monthly/yearly toggle, the Free ↔ Pro table and the pinned buy band —
/// while premium users get their plan and the store-management CTA.
///
/// The page paints its own ground rather than sitting in `Screen`, so the
/// sweep runs under the status bar with no canvas-coloured seam above it. That
/// sweep is [StartAurora] at full strength: the same one behind `/start`, in
/// the same place, so arriving here reads as the last screen of the flow the
/// user has been walking rather than as a pricing page bolted on the end.
class PaywallScreen extends ConsumerWidget {
  const PaywallScreen({super.key, this.onboarding = false});

  /// Presented as the last step of onboarding. Both exits — the close glyph
  /// and "Stay on Free" — then continue INTO the app rather than popping back
  /// to the sign-in surface the user just left.
  final bool onboarding;

  /// Gutter for the note faces. The purchase face sets its own, narrower one
  /// (see [PaywallPurchaseFace.gutter]), and the header spends part of it on
  /// its own 44pt targets (see [PaywallHeader]).
  static const double gutter = KalloSpacing.sp6;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userId = ref.watch(entitlementsUserIdProvider);
    final entitlement = ref.watch(entitlementsProvider(userId));
    final state = ref.watch(paywallControllerProvider);

    return ColoredBox(
      color: KalloColors.hover,
      child: Material(
        type: MaterialType.transparency,
        child: Stack(
          children: [
            const Positioned.fill(child: StartAurora()),
            SafeArea(
              bottom: false,
              child: entitlement.when(
                data: (value) => value.isPremium
                    ? _premium(context, value)
                    : _purchase(context, value, state),
                loading: () => _note(
                  context,
                  PaywallNote(
                    title: tr('paywall.verifying'),
                    body: tr('paywall.verifyPending'),
                    leading: const PaywallSpinner(),
                  ),
                  stayFree: true,
                ),
                // The entitlement never arrived, so we cannot know this user
                // is premium — and an unreadable entitlement is not something
                // they can retry their way out of. Show the ordinary paywall
                // against the conservative free snapshot with the buy button
                // dead, rather than replacing the page with an error the user
                // did not cause.
                error: (_, _) => _purchase(
                  context,
                  EntitlementState.free,
                  state,
                  storeUnavailable: true,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// The plan decision — unless money is already in flight, which is the one
  /// thing that replaces it. A store that never opened does NOT: that face
  /// keeps the table and kills only the button (see
  /// [PaywallPurchaseFace.storeUnavailable]).
  Widget _purchase(
    BuildContext context,
    EntitlementState entitlement,
    PaywallState state, {
    bool storeUnavailable = false,
  }) {
    final mid = _midPurchase(context, state);
    if (mid != null) return mid;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // No trailing slot: "Stay on Free" is a button at the bottom of the
        // band now, in reach of a thumb, rather than a link in the corner.
        _header(context, stayFree: false),
        Expanded(
          child: PaywallPurchaseFace(
            entitlement: entitlement,
            state: state,
            storeUnavailable: storeUnavailable,
            onStayFree: () => _dismiss(context),
          ),
        ),
      ],
    );
  }

  /// The two phases where a payment is genuinely in flight and the user is
  /// owed a word about it. Null on every other phase.
  Widget? _midPurchase(BuildContext context, PaywallState state) =>
      switch (state.phase) {
        PaywallPhase.loading => _note(
          context,
          const PaywallCenteredNote(child: PaywallSpinner()),
          stayFree: true,
        ),
        PaywallPhase.verifying => _note(
          context,
          PaywallNote(
            title: tr('paywall.verifying'),
            body: tr('paywall.verifyPending'),
            leading: const PaywallSpinner(),
          ),
          stayFree: true,
        ),
        PaywallPhase.activationPending => _note(
          context,
          Consumer(
            builder: (context, ref, _) => PaywallRetryNote(
              message: tr('paywall.verifyPending'),
              onRetry: () => ref
                  .read(paywallControllerProvider.notifier)
                  .retryActivation(),
            ),
          ),
          stayFree: true,
        ),
        PaywallPhase.unavailable ||
        PaywallPhase.loadError ||
        PaywallPhase.ready ||
        PaywallPhase.purchasing => null,
      };

  Widget _premium(BuildContext context, EntitlementState entitlement) =>
      _note(context, PaywallPremiumBody(entitlement: entitlement));

  /// [stayFree] is false on the premium face — a subscriber has no Free to
  /// choose — and on the purchase face, which carries its own button for it.
  /// Every note face keeps the header link, so the screen is always closable
  /// two ways.
  Widget _note(BuildContext context, Widget child, {bool stayFree = false}) =>
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _header(context, stayFree: stayFree),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                gutter,
                KalloSpacing.sp4,
                gutter,
                KalloSpacing.sp8,
              ),
              child: child,
            ),
          ),
        ],
      );

  Widget _header(BuildContext context, {required bool stayFree}) =>
      PaywallHeader(
        onClose: () => _dismiss(context),
        onStayFree: stayFree ? () => _dismiss(context) : null,
      );

  void _dismiss(BuildContext context) {
    if (onboarding) {
      goToLogging(context);
    } else {
      popOrOpenLogging(context);
    }
  }
}
