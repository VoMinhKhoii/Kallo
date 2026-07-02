import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../providers/auth_form_controller.dart';

/// The post-sign-up "Check your email" state.
///
/// Replaces the SnackBar that vanished before the user could read it: a real
/// surface that names the address the confirmation went to, with a resend
/// affordance gated by a 30s cooldown so the tap can't spam Supabase's rate
/// limit. "Back" returns to the welcome screen.
class ConfirmEmailView extends ConsumerStatefulWidget {
  const ConfirmEmailView({
    super.key,
    required this.provider,
    required this.onNotice,
  });

  final AutoDisposeStateNotifierProvider<AuthFormController, AuthFormState>
      provider;
  final void Function(String message) onNotice;

  @override
  ConsumerState<ConfirmEmailView> createState() => _ConfirmEmailViewState();
}

class _ConfirmEmailViewState extends ConsumerState<ConfirmEmailView> {
  static const _cooldownSeconds = 30;
  int _remaining = _cooldownSeconds;
  Timer? _timer;
  bool _wasBusy = false;

  @override
  void initState() {
    super.initState();
    _startCooldown();
  }

  void _startCooldown() {
    _remaining = _cooldownSeconds;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      if (_remaining <= 1) {
        t.cancel();
        setState(() => _remaining = 0);
      } else {
        setState(() => _remaining--);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  AuthFormController get _controller => ref.read(widget.provider.notifier);

  void _resend() {
    if (_remaining > 0) return;
    _controller.resendConfirmation();
    _startCooldown();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(widget.provider);
    final busy = state.busy;
    final email = state.pendingEmail ?? '';

    if (_wasBusy && !busy && state.notice != null) {
      final msg = state.notice!;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        widget.onNotice(msg);
        _controller.clearMessages();
      });
    }
    _wasBusy = busy;

    final canResend = _remaining == 0 && !busy;

    return Column(
      key: const ValueKey('confirm-view'),
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: Container(
            width: 56,
            height: 56,
            decoration: const BoxDecoration(
              color: NhamColors.accentSelectedFill,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              LucideIcons.mail,
              size: 24,
              color: NhamColors.accent,
            ),
          ),
        ),
        const SizedBox(height: 20),
        Text(
          tr('auth.confirm.title'),
          textAlign: TextAlign.center,
          style: NhamTextStyles.serifRegular(
            fontSize: NhamFontSize.h3,
          ).copyWith(color: NhamColors.text),
        ),
        const SizedBox(height: 8),
        Text(
          tr('auth.confirm.description'),
          textAlign: TextAlign.center,
          style: dashBody(color: kInkMuted),
        ),
        const SizedBox(height: 2),
        Text(
          email,
          textAlign: TextAlign.center,
          style: dashBody(weight: FontWeight.w500),
        ),
        const SizedBox(height: 12),
        Text(
          tr('auth.confirm.hint'),
          textAlign: TextAlign.center,
          style: dashMeta(),
        ),
        const SizedBox(height: 24),
        // Resend (cooldown-gated).
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: canResend ? _resend : null,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: NhamSpacing.sp4,
              vertical: NhamSpacing.sp3,
            ),
            decoration: BoxDecoration(
              color: NhamColors.elev,
              borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
              border: Border.all(color: NhamColors.border),
            ),
            alignment: Alignment.center,
            child: Text(
              canResend
                  ? tr('auth.confirm.resend')
                  : tr(
                      'auth.confirm.resendIn',
                      namedArgs: {'seconds': '$_remaining'},
                    ),
              style: dashBody(
                weight: FontWeight.w500,
                color: canResend ? NhamColors.text : kInkMuted,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Center(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: busy ? null : _controller.clearPendingEmail,
            child: Text(
              tr('auth.confirm.back'),
              style: dashBody(color: kInkMuted),
            ),
          ),
        ),
      ],
    );
  }
}
