import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../services/auth/session_provider.dart';
import '../../../../shared/widgets/dialog/kallo_confirm.dart';
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
    // "Đăng xuất" beside "Huỷ" is unambiguous, so it keeps its verb; the
    // open cue now lives inside showKalloConfirm.
    final confirmed = await showKalloConfirm(
      context,
      title: tr('settings.account.signOutConfirmTitle'),
      confirmLabel: tr('settings.account.signOut'),
      destructive: true,
    );
    if (!confirmed || _signingOut || !mounted) return;
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
