import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../services/auth/session_provider.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../list/settings_row.dart';

/// Sign out — the bottom-most action on the settings screen, in danger red.
///
/// It lives on its own below every group (not inside Account) for two reasons:
/// it is the one row people reach for by muscle memory, so it belongs at the
/// very bottom of the scroll; and stacking it directly under the equally-red
/// "Delete account" row would put a reversible action and an irreversible one
/// side by side in the same colour.
///
/// Confirmation stays a [CupertinoActionSheet] — one tap can't end the session.
class SignOutRow extends ConsumerStatefulWidget {
  const SignOutRow({super.key});

  @override
  ConsumerState<SignOutRow> createState() => _SignOutRowState();
}

class _SignOutRowState extends ConsumerState<SignOutRow> {
  bool _signingOut = false;

  Future<void> _confirm() async {
    HapticFeedback.lightImpact(); // sheet-open cue
    final confirmed = await showCupertinoModalPopup<bool>(
      context: context,
      builder:
          (sheetContext) => CupertinoActionSheet(
            title: Text(tr('settings.account.signOutConfirmTitle')),
            actions: [
              CupertinoActionSheetAction(
                isDestructiveAction: true,
                onPressed: () => Navigator.of(sheetContext).pop(true),
                child: Text(tr('settings.account.signOut')),
              ),
            ],
            cancelButton: CupertinoActionSheetAction(
              onPressed: () => Navigator.of(sheetContext).pop(false),
              child: Text(tr('settings.account.cancel')),
            ),
          ),
    );
    if (confirmed != true || _signingOut || !mounted) return;
    setState(() => _signingOut = true);
    try {
      await ref.read(authControllerProvider).signOut();
      if (!mounted) return;
      context.go('/sign-in');
    } catch (_) {
      if (!mounted) return;
      setState(() => _signingOut = false);
      showTopToast(
        context,
        tr('app.userMenu.signOutError'),
        variant: TopToastVariant.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return SettingsRow(
      icon: LucideIcons.logOut300,
      label: tr('settings.account.signOut'),
      danger: true,
      busy: _signingOut,
      enabled: !_signingOut,
      onTap: _confirm,
    );
  }
}
