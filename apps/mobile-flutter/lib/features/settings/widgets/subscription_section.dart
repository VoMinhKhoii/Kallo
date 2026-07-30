import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../data/billing/entitlement_state.dart';
import '../../../data/billing/entitlements_provider.dart';
import '../../../data/billing/purchases_service.dart';
import '../../../data/session_provider.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../paywall/store_subscriptions.dart';
import 'settings_group.dart';
import 'settings_row.dart';

/// Current plan state, store-management access, and purchase restoration.
class SubscriptionSection extends ConsumerStatefulWidget {
  const SubscriptionSection({super.key});

  @override
  ConsumerState<SubscriptionSection> createState() =>
      _SubscriptionSectionState();
}

class _SubscriptionSectionState extends ConsumerState<SubscriptionSection> {
  bool _restoring = false;

  @override
  Widget build(BuildContext context) {
    final userId = ref.watch(entitlementsUserIdProvider);
    final entitlementAsync = ref.watch(entitlementsProvider(userId));
    final entitlement = entitlementAsync.valueOrNull;
    final isPremium = entitlement?.isPremium ?? false;
    if (entitlement != null && !entitlement.purchasesEnabled && !isPremium) {
      return const SizedBox.shrink();
    }

    final rows = <Widget>[
      SettingsRow(
        icon: LucideIcons.sparkles300,
        label: tr('settings.subscription.row'),
        subline: _statusSubline(context, entitlementAsync),
        showChevron: true,
        onTap: () => context.push('/paywall'),
      ),
    ];

    if (isPremium &&
        entitlement?.hasActiveSubscription == true &&
        entitlement?.managementUrl != null) {
      rows.add(
        SettingsRow(
          icon: LucideIcons.externalLink300,
          label: tr('settings.subscription.manage'),
          onTap:
              () =>
                  openStoreSubscriptions(context, entitlement!.managementUrl!),
        ),
      );
    }

    rows.add(
      SettingsRow(
        icon: LucideIcons.refreshCw300,
        label: tr('settings.subscription.restore'),
        busy: _restoring,
        enabled: !_restoring,
        onTap: _restore,
      ),
    );

    return SettingsGroup(
      label: tr('settings.subscription.groupLabel'),
      children: rows,
    );
  }

  String _statusSubline(BuildContext context, AsyncValue<EntitlementState> e) {
    final value = e.valueOrNull;
    if (value == null) return tr('common.loading');
    if (value.isLifetime) return tr('settings.subscription.statusLifetime');
    if (value.isPremium) {
      final date = value.expiresAt;
      if (date == null) {
        return tr(
          'settings.subscription.statusPremium',
          namedArgs: {'date': ''},
        ).trim();
      }
      final formatted = DateFormat.yMMMd(
        context.locale.languageCode,
      ).format(date);
      return tr(
        value.willRenew
            ? 'settings.subscription.statusPremium'
            : 'settings.subscription.statusPremiumCancelled',
        namedArgs: {'date': formatted},
      );
    }
    if (value.isTrialing) {
      final days = value.trial.daysRemaining;
      return days <= 1
          ? tr('settings.subscription.statusTrialLastDay')
          : tr(
            'settings.subscription.statusTrial',
            namedArgs: {'days': '$days'},
          );
    }
    return tr('settings.subscription.statusFree');
  }

  Future<void> _restore() async {
    if (_restoring) return;
    setState(() => _restoring = true);
    final purchases = ref.read(purchasesServiceProvider);
    if (!purchases.purchasesAvailable) {
      if (mounted) {
        setState(() => _restoring = false);
        showTopToast(
          context,
          tr('paywall.unavailableBody'),
          variant: TopToastVariant.error,
        );
      }
      return;
    }

    final userId = ref.read(currentSessionProvider)?.user.id;
    final restoreAttempt =
        userId == null
            ? const RestoreAttempt(RestoreOutcome.error)
            : await purchases.restorePurchases(userId);
    if (!mounted) return;
    if (userId != ref.read(currentSessionProvider)?.user.id) {
      setState(() => _restoring = false);
      return;
    }
    switch (restoreAttempt.outcome) {
      case RestoreOutcome.restored:
        break;
      case RestoreOutcome.nothingToRestore:
        _finishRestore(tr('paywall.restoreNothing'));
        return;
      case RestoreOutcome.accountConflict:
        _finishRestore(tr('paywall.restoreAccountConflict'));
        return;
      case RestoreOutcome.error:
        _finishRestore(tr('paywall.restoreError'));
        return;
    }

    final premium =
        await ref
            .read(entitlementsProvider(userId).notifier)
            .pollUntilPremium();
    if (!mounted) return;
    if (userId != ref.read(currentSessionProvider)?.user.id) {
      setState(() => _restoring = false);
      return;
    }

    setState(() => _restoring = false);
    showTopToast(
      context,
      premium
          ? tr(
            'settings.subscription.statusPremium',
            namedArgs: {'date': ''},
          ).trim()
          : tr('paywall.verifyPending'),
      variant: TopToastVariant.success,
    );
  }

  void _finishRestore(String message) {
    setState(() => _restoring = false);
    showTopToast(context, message, variant: TopToastVariant.error);
  }
}
