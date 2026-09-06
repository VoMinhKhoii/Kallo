import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/billing/entitlement_state.dart';
import '../../../services/billing/entitlements_provider.dart';
import '../../../shell/nav/nav_actions.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../data/paywall_controller.dart';
import '../widgets/paywall_header.dart';
import '../widgets/paywall_plan_sheet.dart';
import '../widgets/paywall_premium_body.dart';
import '../widgets/paywall_pro_band.dart';
import '../widgets/paywall_status.dart';

/// Kallo Pro. Free and trial-expired users get the two-tier face — the pitch
/// on the warm band, the plans on a white sheet pinned to the bottom edge —
/// while premium users get their plan and the store-management CTA. The page
/// paints [KalloColors.hover] edge to edge rather than sitting in `Screen`, so
/// the band runs under the status bar with no canvas-coloured seam above it.
class PaywallScreen extends ConsumerWidget {
  const PaywallScreen({super.key, this.onboarding = false});

  /// Presented as the last step of onboarding. Both exits — the close glyph
  /// and "Stay on Free" — then continue INTO the app rather than popping back
  /// to the sign-in surface the user just left. (The router wiring that passes
  /// this is Phase C2.)
  final bool onboarding;

  /// Gutter for everything on the band. The header row spends part of it on
  /// its own 44pt targets — see [PaywallHeader].
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
        child: SafeArea(
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
            ),
            error: (_, _) => _note(
              context,
              PaywallRetryNote(
                message: tr('paywall.loadError'),
                onRetry: () => ref
                    .read(entitlementsProvider(userId).notifier)
                    .reconcile(),
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Band above, sheet below — pinned by [SliverFillRemaining], not a
  /// [Column]: at 320pt with large text the two are taller than the screen, and
  /// a Column can only push the excess off the bottom edge.
  Widget _purchase(
    BuildContext context,
    EntitlementState entitlement,
    PaywallState state,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _header(context, stayFree: true),
        Expanded(
          child: CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(
                  gutter,
                  KalloSpacing.sp4,
                  gutter,
                  KalloSpacing.sp5,
                ),
                sliver: SliverToBoxAdapter(
                  child: PaywallProBand(entitlement: entitlement),
                ),
              ),
              SliverFillRemaining(
                hasScrollBody: false,
                child: Align(
                  alignment: Alignment.bottomCenter,
                  child: PaywallPlanSheet(
                    entitlement: entitlement,
                    state: state,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _premium(BuildContext context, EntitlementState entitlement) =>
      _note(context, PaywallPremiumBody(entitlement: entitlement));

  Widget _note(BuildContext context, Widget child) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _header(context, stayFree: false),
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
        gutter: gutter,
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
