import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../data/api_client.dart';
import '../../../data/billing/entitlements_provider.dart';
import '../../../data/session_provider.dart';
import '../../../shared/widgets/kallo_primitives.dart';
import '../../../shared/widgets/scroll_separator.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../paywall/store_subscriptions.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../logic/settings_spacing.dart';
import '../widgets/settings_header.dart';

/// Pushed delete-account screen: plain-language consequences and a type-to-
/// confirm gate before the irreversible deletion.
class AccountDeleteScreen extends ConsumerStatefulWidget {
  const AccountDeleteScreen({super.key});

  @override
  ConsumerState<AccountDeleteScreen> createState() =>
      _AccountDeleteScreenState();
}

class _AccountDeleteScreenState extends ConsumerState<AccountDeleteScreen> {
  final _controller = TextEditingController();
  bool _deleting = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _canDelete =>
      _controller.text.trim() == tr('settings.account.deleteConfirmWord') &&
      !_deleting;

  Future<void> _delete() async {
    if (!_canDelete) return;
    setState(() => _deleting = true);
    try {
      await ref.read(apiClientProvider).deleteAccount();
    } catch (_) {
      if (!mounted) return;
      setState(() => _deleting = false);
      showTopToast(
        context,
        tr('settings.account.deleteError'),
        variant: TopToastVariant.error,
      );
      return;
    }

    // The account is gone server-side. A local sign-out failure should not make
    // the destructive action look like it failed.
    try {
      await ref.read(authControllerProvider).signOut();
    } catch (_) {
      // Ignore: routing to sign-in clears the user's path out of the deleted
      // account state, and Supabase will refresh/reject the stale session.
    }
    if (!mounted) return;
    context.go('/sign-in');
  }

  @override
  Widget build(BuildContext context) {
    final userId = ref.watch(entitlementsUserIdProvider);
    final entitlement = ref.watch(entitlementsProvider(userId)).valueOrNull;

    return Screen(
      bottom: false,
      child: ScrollSeparator(
        header: SettingsHeader(title: tr('settings.account.deleteScreenTitle')),
        child: SingleChildScrollView(
          padding: SettingsSpacing.page,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // No title here — it lives in the header bar. This is the
              // consequence line that used to sit under it.
              Text(tr('settings.account.deleteConsequence'), style: dashBody()),
              const SizedBox(height: KalloSpacing.sp3),
              Container(
                padding: const EdgeInsets.all(KalloSpacing.sp3),
                decoration: BoxDecoration(
                  color: KalloColors.danger.withValues(alpha: 0.06),
                  border: Border.all(
                    color: KalloColors.danger.withValues(alpha: 0.3),
                  ),
                  borderRadius: BorderRadius.circular(KalloRadii.xxxl),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      tr('settings.account.deleteSubscriptionWarning'),
                      style: dashBody(),
                    ),
                    if (entitlement?.managementUrl != null) ...[
                      const SizedBox(height: KalloSpacing.sp2),
                      KalloButton(
                        title: tr('settings.account.deleteManageSubscription'),
                        variant: KalloButtonVariant.secondary,
                        onPressed:
                            () => openStoreSubscriptions(
                              context,
                              entitlement!.managementUrl!,
                            ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: KalloSpacing.sp5),
              Text(
                tr(
                  'settings.account.deleteConfirmLabel',
                  namedArgs: {'word': tr('settings.account.deleteConfirmWord')},
                ),
                style: dashMeta(),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _controller,
                autocorrect: false,
                enableSuggestions: false,
                textCapitalization: TextCapitalization.characters,
                style: dashBody(),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: KalloColors.surface,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
                    borderSide: const BorderSide(color: KalloColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
                    borderSide: const BorderSide(color: KalloColors.danger),
                  ),
                ),
              ),
              const SizedBox(height: KalloSpacing.sp4),
              _DeleteButton(
                enabled: _canDelete,
                deleting: _deleting,
                onTap: _delete,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DeleteButton extends StatelessWidget {
  const _DeleteButton({
    required this.enabled,
    required this.deleting,
    required this.onTap,
  });

  final bool enabled;
  final bool deleting;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1.0 : 0.4,
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: KalloColors.danger,
            borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
          ),
          child: Center(
            child:
                deleting
                    ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                    : Text(
                      tr('settings.account.deleteConfirmAction'),
                      style: dashBody(
                        weight: FontWeight.w500,
                        color: Colors.white,
                      ),
                    ),
          ),
        ),
      ),
    );
  }
}
