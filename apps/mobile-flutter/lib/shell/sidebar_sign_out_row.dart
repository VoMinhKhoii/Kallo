import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../data/session_provider.dart';
import '../shared/widgets/top_toast.dart';
import '../theme/nham_colors.dart';
import '../theme/nham_theme.dart';
import '../theme/nham_typography.dart';

/// Footer Sign-out row — danger text, danger@10% press fill, opacity 60% +
/// disabled while the request is in flight.
class SignOutRow extends StatefulWidget {
  const SignOutRow({required this.ref, required this.onClose, super.key});

  final WidgetRef ref;
  final VoidCallback onClose;

  @override
  State<SignOutRow> createState() => _SignOutRowState();
}

class _SignOutRowState extends State<SignOutRow> {
  bool _pressed = false;
  bool _signingOut = false;

  Future<void> _signOut() async {
    if (_signingOut) return;
    setState(() => _signingOut = true);
    try {
      await widget.ref.read(authControllerProvider).signOut();
      if (!mounted) return;
      // Close the drawer, then route to /sign-in explicitly. The router's auth
      // refresh also redirects on the cleared session, but the explicit nav is
      // a backstop so a missed redirect can't strand the user in the app.
      widget.onClose();
      context.go('/sign-in');
    } catch (error) {
      // Don't swallow it: reset so the row is tappable again and tell the user.
      debugPrint('Sign-out failed: $error');
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
    final Color? fill =
        _pressed ? const Color(0x1AD37B69) : null; // danger @ 10%

    return Opacity(
      opacity: _signingOut ? 0.6 : 1.0,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: _signingOut ? null : (_) => setState(() => _pressed = true),
        onTapUp: _signingOut ? null : (_) => setState(() => _pressed = false),
        onTapCancel:
            _signingOut ? null : () => setState(() => _pressed = false),
        onTap: _signingOut ? null : _signOut,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          curve: Curves.easeInOut,
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: fill,
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
          ),
          child: Row(
            children: [
              const Icon(
                LucideIcons.logOut,
                size: 16,
                color: NhamColors.danger,
              ),
              const SizedBox(width: 12),
              Text(
                tr('app.userMenu.signOut'),
                style: NhamTextStyles.sansMedium(
                  fontSize: 13,
                ).copyWith(color: NhamColors.danger),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
