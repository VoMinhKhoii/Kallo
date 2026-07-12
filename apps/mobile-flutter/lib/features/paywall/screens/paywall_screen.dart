import 'dart:io' show Platform;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../data/billing/entitlements_provider.dart';
import '../../../shared/widgets/nham_primitives.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../paywall_controller.dart';
import '../widgets/package_card.dart';

/// AI-analysis-focused paywall. Two copy variants:
///   • upsell — the default pitch (free user, or trial still active),
///   • expired — "your free week has ended" (trial ran out, still free).
///
/// Already-premium / lifetime users get a "you're on Premium" state with a
/// link out to store subscription management instead of package cards.
class PaywallScreen extends ConsumerWidget {
  const PaywallScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entitlement =
        ref.watch(entitlementsProvider).valueOrNull ?? EntitlementState.free;
    final state = ref.watch(paywallControllerProvider);

    return Screen(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _CloseHeader(onClose: () => _dismiss(context)),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                NhamSpacing.sp5,
                NhamSpacing.sp4,
                NhamSpacing.sp5,
                NhamSpacing.sp8,
              ),
              child:
                  entitlement.isPremium
                      ? _PremiumBody(entitlement: entitlement)
                      : _PurchaseBody(entitlement: entitlement, state: state),
            ),
          ),
        ],
      ),
    );
  }

  void _dismiss(BuildContext context) {
    final router = GoRouter.of(context);
    if (router.canPop()) {
      router.pop();
    } else {
      context.go('/logging');
    }
  }
}

/// The upsell / trial-expired variant: pitch + trial countdown + package cards.
class _PurchaseBody extends ConsumerWidget {
  const _PurchaseBody({required this.entitlement, required this.state});

  final EntitlementState entitlement;
  final PaywallState state;

  bool get _expiredVariant =>
      entitlement.aiAnalysis.reason == FeatureReason.trialExpired;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eyebrow =
        _expiredVariant
            ? tr('paywall.expiredEyebrow')
            : tr('paywall.upsellEyebrow');
    final title =
        _expiredVariant
            ? tr('paywall.expiredTitle')
            : tr('paywall.upsellTitle');
    final body =
        _expiredVariant ? tr('paywall.expiredBody') : tr('paywall.upsellBody');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(eyebrow.toUpperCase(), style: dashEyebrow()),
        const SizedBox(height: NhamSpacing.sp2),
        Text(
          title,
          style: NhamTextStyles.serifRegular(
            fontSize: NhamFontSize.h2,
          ).copyWith(letterSpacing: -0.3, color: NhamColors.text),
        ),
        const SizedBox(height: NhamSpacing.sp3),
        Text(body, style: dashBody(color: kInkMuted)),

        // Trial countdown when the trial is active.
        if (entitlement.trial.active) ...[
          const SizedBox(height: NhamSpacing.sp4),
          _TrialCountdown(trial: entitlement.trial),
        ],

        const SizedBox(height: NhamSpacing.sp5),
        const _FeatureList(),
        const SizedBox(height: NhamSpacing.sp5),

        // Packages / states.
        _Body(entitlement: entitlement, state: state),

        const SizedBox(height: NhamSpacing.sp4),
        _RestoreRow(state: state),
        const SizedBox(height: NhamSpacing.sp4),
        Text(
          tr('paywall.legal'),
          style: dashMeta().copyWith(fontSize: 11, height: 1.4),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

/// Renders the packages, or the loading / error / unavailable / verifying state.
class _Body extends ConsumerWidget {
  const _Body({required this.entitlement, required this.state});

  final EntitlementState entitlement;
  final PaywallState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    switch (state.phase) {
      case PaywallPhase.loading:
        return const _CenteredNote(child: _Spinner());
      case PaywallPhase.unavailable:
        return _Note(
          title: tr('paywall.unavailableTitle'),
          body: tr('paywall.unavailableBody'),
        );
      case PaywallPhase.loadError:
        return _RetryNote(
          message: tr('paywall.loadError'),
          onRetry:
              () =>
                  ref.read(paywallControllerProvider.notifier).loadOfferings(),
        );
      case PaywallPhase.verifying:
        return _Note(
          title: tr('paywall.verifying'),
          body: tr('paywall.verifyPending'),
          leading: const _Spinner(),
        );
      case PaywallPhase.ready:
      case PaywallPhase.purchasing:
        return _PackageList(entitlement: entitlement, state: state);
    }
  }
}

class _PackageList extends ConsumerWidget {
  const _PackageList({required this.entitlement, required this.state});

  final EntitlementState entitlement;
  final PaywallState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (state.packages.isEmpty) {
      return _RetryNote(
        message: tr('paywall.loadError'),
        onRetry:
            () => ref.read(paywallControllerProvider.notifier).loadOfferings(),
      );
    }
    final purchasing = state.phase == PaywallPhase.purchasing;
    // Trial-active users are already "in" premium via the trial — the CTA reads
    // "Continue Premium" rather than "Start Premium".
    final ctaKey =
        entitlement.trial.active ? 'paywall.purchaseTrial' : 'paywall.purchase';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final pkg in state.packages) ...[
          PackageCard(
            package: pkg,
            ctaLabel: tr(ctaKey),
            busy: state.busyPackageId == pkg.identifier,
            // Disable other cards while one purchase is in flight.
            enabled: !purchasing,
            onTap: () => _onPurchase(context, ref, pkg),
          ),
          const SizedBox(height: NhamSpacing.sp3),
        ],
      ],
    );
  }

  Future<void> _onPurchase(
    BuildContext context,
    WidgetRef ref,
    Package pkg,
  ) async {
    final result = await ref
        .read(paywallControllerProvider.notifier)
        .purchase(pkg);
    if (!context.mounted) return;
    _handleResult(context, result);
  }
}

/// Shared handling of a purchase/restore outcome: dismiss on unlock, toast
/// otherwise. userCancelled is silent.
void _handleResult(BuildContext context, PaywallActionResult result) {
  switch (result) {
    case PaywallActionResult.unlocked:
      final router = GoRouter.of(context);
      if (router.canPop()) {
        router.pop();
      } else {
        context.go('/logging');
      }
    case PaywallActionResult.pending:
      showTopToast(context, tr('paywall.verifyPending'));
    case PaywallActionResult.nothingToRestore:
      showTopToast(
        context,
        tr('paywall.restoreNothing'),
        variant: TopToastVariant.error,
      );
    case PaywallActionResult.error:
      showTopToast(
        context,
        tr('paywall.purchaseError'),
        variant: TopToastVariant.error,
      );
    case PaywallActionResult.cancelled:
      break; // silent
  }
}

class _RestoreRow extends ConsumerWidget {
  const _RestoreRow({required this.state});

  final PaywallState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final busy =
        state.phase == PaywallPhase.purchasing ||
        state.phase == PaywallPhase.verifying;
    return Center(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap:
            busy
                ? null
                : () async {
                  HapticFeedback.lightImpact();
                  final result =
                      await ref
                          .read(paywallControllerProvider.notifier)
                          .restore();
                  if (!context.mounted) return;
                  _handleResult(context, result);
                },
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp2),
          child: Text(
            tr('paywall.restore'),
            style: dashBody(
              weight: FontWeight.w500,
              color: busy ? kInkMuted : NhamColors.text,
            ),
          ),
        ),
      ),
    );
  }
}

/// The already-premium / lifetime state: confirmation + manage-in-store link.
class _PremiumBody extends StatelessWidget {
  const _PremiumBody({required this.entitlement});

  final EntitlementState entitlement;

  @override
  Widget build(BuildContext context) {
    final body =
        entitlement.isLifetime
            ? tr('paywall.alreadyLifetimeBody')
            : tr('paywall.alreadyPremiumBody');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(LucideIcons.sparkles, size: 32, color: NhamColors.accent),
        const SizedBox(height: NhamSpacing.sp4),
        Text(
          tr('paywall.alreadyPremiumTitle'),
          style: NhamTextStyles.serifRegular(
            fontSize: NhamFontSize.h2,
          ).copyWith(letterSpacing: -0.3, color: NhamColors.text),
        ),
        const SizedBox(height: NhamSpacing.sp3),
        Text(body, style: dashBody(color: kInkMuted)),
        const SizedBox(height: NhamSpacing.sp5),
        const _FeatureList(),
        // Lifetime purchases have nothing to manage in the store.
        if (!entitlement.isLifetime) ...[
          const SizedBox(height: NhamSpacing.sp6),
          NhamButton(
            title: tr('paywall.manageActive'),
            variant: NhamButtonVariant.secondary,
            onPressed: () => openStoreSubscriptions(context),
          ),
        ],
      ],
    );
  }
}

class _TrialCountdown extends StatelessWidget {
  const _TrialCountdown({required this.trial});

  final TrialState trial;

  @override
  Widget build(BuildContext context) {
    final label =
        trial.daysRemaining <= 1
            ? tr('paywall.trialCountdownLastDay')
            : tr(
              'paywall.trialCountdown',
              namedArgs: {'days': '${trial.daysRemaining}'},
            );
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: NhamSpacing.sp3,
        vertical: NhamSpacing.sp2_5,
      ),
      decoration: BoxDecoration(
        color: NhamColors.accent10,
        borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(LucideIcons.clock, size: 15, color: NhamColors.accentDark),
          const SizedBox(width: NhamSpacing.sp2),
          Flexible(
            child: Text(
              label,
              style: dashMeta(
                color: NhamColors.text,
              ).copyWith(fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }
}

class _FeatureList extends StatelessWidget {
  const _FeatureList();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _FeatureRow(text: tr('paywall.feature1')),
        const SizedBox(height: NhamSpacing.sp3),
        _FeatureRow(text: tr('paywall.feature2')),
        const SizedBox(height: NhamSpacing.sp3),
        _FeatureRow(text: tr('paywall.feature3')),
      ],
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 1),
          child: Icon(
            LucideIcons.check,
            size: 17,
            color: NhamColors.accentDark,
          ),
        ),
        const SizedBox(width: NhamSpacing.sp3),
        Expanded(child: Text(text, style: dashBody())),
      ],
    );
  }
}

/// Opens the platform's subscription-management surface. iOS: the App Store
/// subscriptions screen; Android: the Play Store subscriptions deep link.
Future<void> openStoreSubscriptions(BuildContext context) async {
  final uri =
      Platform.isIOS || Platform.isMacOS
          ? Uri.parse('itms-apps://apps.apple.com/account/subscriptions')
          : Uri.parse('https://play.google.com/store/account/subscriptions');
  final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) {
    showTopToast(
      context,
      tr('paywall.purchaseError'),
      variant: TopToastVariant.error,
    );
  }
}

class _CloseHeader extends StatelessWidget {
  const _CloseHeader({required this.onClose});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: NhamSpacing.sp4,
        vertical: NhamSpacing.sp3,
      ),
      child: Align(
        alignment: Alignment.centerRight,
        child: Semantics(
          button: true,
          label: tr('common.close'),
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onClose,
            child: const Icon(LucideIcons.x, size: 22, color: kInkMuted),
          ),
        ),
      ),
    );
  }
}

class _Spinner extends StatelessWidget {
  const _Spinner();

  @override
  Widget build(BuildContext context) => const SizedBox(
    width: 22,
    height: 22,
    child: CircularProgressIndicator(
      strokeWidth: 2,
      valueColor: AlwaysStoppedAnimation(NhamColors.accent),
    ),
  );
}

class _CenteredNote extends StatelessWidget {
  const _CenteredNote({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp6),
    child: Center(child: child),
  );
}

class _Note extends StatelessWidget {
  const _Note({required this.title, required this.body, this.leading});

  final String title;
  final String body;
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp4),
      decoration: BoxDecoration(
        color: NhamColors.track,
        borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (leading != null) ...[
            leading!,
            const SizedBox(height: NhamSpacing.sp3),
          ],
          Text(title, style: dashBody(weight: FontWeight.w500)),
          const SizedBox(height: 4),
          Text(body, style: dashMeta()),
        ],
      ),
    );
  }
}

class _RetryNote extends StatelessWidget {
  const _RetryNote({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Note(title: message, body: tr('common.retry')),
        const SizedBox(height: NhamSpacing.sp3),
        NhamButton(
          title: tr('common.retry'),
          variant: NhamButtonVariant.secondary,
          onPressed: onRetry,
        ),
      ],
    );
  }
}
