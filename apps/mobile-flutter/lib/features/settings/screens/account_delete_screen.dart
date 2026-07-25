import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../data/api_client.dart';
import '../../../data/session_provider.dart';
import '../../../shared/widgets/nham_primitives.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';

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
    return Screen(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _DeleteBackHeader(onBack: () => Navigator.of(context).maybePop()),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                NhamSpacing.sp5,
                NhamSpacing.sp4,
                NhamSpacing.sp5,
                NhamSpacing.sp6,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    tr('settings.account.deleteScreenTitle'),
                    style: NhamTextStyles.serifRegular(
                      fontSize: NhamFontSize.h3,
                    ).copyWith(color: NhamColors.text),
                  ),
                  const SizedBox(height: NhamSpacing.sp3),
                  Text(
                    tr('settings.account.deleteConsequence'),
                    style: dashBody(),
                  ),
                  const SizedBox(height: NhamSpacing.sp5),
                  Text(
                    tr(
                      'settings.account.deleteConfirmLabel',
                      namedArgs: {
                        'word': tr('settings.account.deleteConfirmWord'),
                      },
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
                      fillColor: NhamColors.surface,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
                        borderSide: const BorderSide(color: NhamColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
                        borderSide: const BorderSide(color: NhamColors.danger),
                      ),
                    ),
                  ),
                  const SizedBox(height: NhamSpacing.sp4),
                  _DeleteButton(
                    enabled: _canDelete,
                    deleting: _deleting,
                    onTap: _delete,
                  ),
                ],
              ),
            ),
          ),
        ],
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
            color: NhamColors.danger,
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
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
                      style: dashBody(weight: FontWeight.w500, color: Colors.white),
                    ),
          ),
        ),
      ),
    );
  }
}

class _DeleteBackHeader extends StatelessWidget {
  const _DeleteBackHeader({required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: NhamColors.surface,
        border: Border(bottom: BorderSide(color: NhamColors.border)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onBack,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                LucideIcons.arrowLeft,
                size: 16,
                color: kInkMuted,
              ),
              const SizedBox(width: 6),
              Text(
                tr('settings.title'),
                style: dashBody(weight: FontWeight.w500, color: kInkMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
