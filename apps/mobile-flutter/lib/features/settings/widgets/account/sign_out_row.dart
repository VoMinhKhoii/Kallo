import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../services/auth/session_provider.dart';
import '../../../../services/push/push_service.dart';
import '../../../../shared/widgets/dialog/kallo_confirm.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../shared/widgets/list/list_row.dart';

/// Sign out — the bottom-most action on the settings screen, in danger red.
///
/// It lives on its own below every group (not inside Account) for two reasons:
/// it is the one row people reach for by muscle memory, so it belongs at the
/// very bottom of the scroll; and stacking it directly under the equally-red
/// "Delete account" row would put a reversible action and an irreversible one
/// side by side in the same colour.
///
/// It always confirms — one tap can't end the session — through the app's own
/// [showKalloConfirm] rather than a [CupertinoActionSheet]. The two-tap reason
/// survives; the platform chrome does not, so this reads like every other
/// confirm in the app.
class SignOutRow extends ConsumerStatefulWidget {
  const SignOutRow({super.key});

  @override
  ConsumerState<SignOutRow> createState() => _SignOutRowState();
}

class _SignOutRowState extends ConsumerState<SignOutRow> {
  bool _signingOut = false;

  Future<void> _confirm() async {
    // Both sides name an outcome: leaving the session, or staying in it.
    final confirmed = await showKalloConfirm(
      context,
      title: tr('settings.account.signOutConfirmTitle'),
      confirmLabel: tr('settings.account.signOut'),
      cancelLabel: tr('common.actions.staySignedIn'),
      destructive: true,
    );
    if (!confirmed || _signingOut || !mounted) return;
    setState(() => _signingOut = true);
    try {
      // Release the APNs device token BEFORE the session goes: the DELETE
      // rides the same Bearer token. It never throws — a failed release must
      // not strand the user in a signed-in app.
      await ref.read(pushServiceProvider).unregister();
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
    return ListRow(
      icon: LucideIcons.logOut300,
      label: tr('settings.account.signOut'),
      danger: true,
      busy: _signingOut,
      onTap: _confirm,
    );
  }
}
