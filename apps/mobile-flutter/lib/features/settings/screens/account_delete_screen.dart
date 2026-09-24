import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../services/http/api_client.dart';
import '../../../services/billing/entitlements_provider.dart';
import '../../../services/auth/session_provider.dart';
import '../../../shared/widgets/form/kallo_text_field.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../shared/widgets/surface/scroll_separator.dart';
import '../../../shared/widgets/toast/top_toast.dart';
import '../../paywall/logic/store_subscriptions.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../logic/settings_spacing.dart';
import '../widgets/list/settings_group.dart';
import '../../../shared/widgets/list/list_row.dart';
import '../../../shared/widgets/chrome/inline_nav_bar.dart';
import '../../../shared/widgets/typography/section_header_row.dart';

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
        header: InlineNavBar.page(
          title: tr('settings.account.deleteScreenTitle'),
          parentTitle: tr('settings.title'),
        ),
        child: SingleChildScrollView(
          padding: SettingsSpacing.rowList(context),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── The subscription — deleting does not cancel it ──────────
              // The warning reads as a footnote under the one thing to do
              // about it, not as a red panel: nothing here is an error yet.
              if (entitlement?.managementUrl != null) ...[
                SettingsGroup(
                  label: tr('settings.subscription.groupLabel'),
                  children: [
                    ListRow(
                      label: tr('settings.account.deleteManageSubscription'),
                      trailing: const Icon(
                        LucideIcons.externalLink300,
                        size: KalloIcons.tertiary,
                        color: kInkMuted,
                      ),
                      onTap:
                          () => openStoreSubscriptions(
                            context,
                            entitlement!.managementUrl!,
                          ),
                    ),
                  ],
                ),
                const SizedBox(height: KalloSpacing.sp2),
              ],
              Text(
                tr('settings.account.deleteSubscriptionWarning'),
                style: dashMeta(),
              ),
              const SizedBox(height: KalloSpacing.sp6),

              // ── The gate — type the word, read what it costs ────────────
              GroupLabel(
                tr(
                  'settings.account.deleteConfirmLabel',
                  namedArgs: {'word': tr('settings.account.deleteConfirmWord')},
                ),
              ),
              const SizedBox(height: SettingsSpacing.label),
              KalloTextField(
                controller: _controller,
                hintText: tr('settings.account.deleteConfirmWord'),
                // The value has to match a literal word — autocorrect and
                // suggestions can only get in the way of typing it.
                autocorrect: false,
                enableSuggestions: false,
                textCapitalization: TextCapitalization.characters,
              ),
              const SizedBox(height: KalloSpacing.sp2),
              Text(tr('settings.account.deleteConsequence'), style: dashMeta()),
              const SizedBox(height: KalloSpacing.sp6),
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

/// The one SOLID-red button in the app.
///
/// It is not a [KalloButton] variant on purpose: the system's `danger` is a
/// quiet red-on-transparent affordance for reversible destructive rows, and
/// this is the irreversible confirm at the end of a type-to-confirm gate — the
/// one place a filled red belongs. Everything else about it is the button
/// system: 50pt, fully rounded, the shared [kButtonLabel].
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
    return Semantics(
      button: true,
      enabled: enabled,
      excludeSemantics: true,
      label: tr('settings.account.deleteConfirmAction'),
      onTap: enabled ? onTap : null,
      child: Opacity(
        opacity: enabled ? 1.0 : 0.4,
        child: GestureDetector(
          onTap: enabled ? onTap : null,
          child: Container(
            constraints: const BoxConstraints(minHeight: 50),
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              color: KalloColors.danger,
              borderRadius: BorderRadius.circular(KalloRadii.button),
            ),
            child: Center(
              child:
                  deleting
                      ? const CupertinoActivityIndicator(
                        radius: 8,
                        color: CupertinoColors.white,
                      )
                      : Text(
                        tr('settings.account.deleteConfirmAction'),
                        style: kButtonLabel(color: Colors.white),
                      ),
            ),
          ),
        ),
      ),
    );
  }
}
