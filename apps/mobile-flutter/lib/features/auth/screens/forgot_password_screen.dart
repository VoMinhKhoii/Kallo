import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../data/env.dart';
import '../../../services/supabase_service.dart';
import '../../../shared/widgets/nham_primitives.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';
import '../widgets/auth_submit_button.dart';
import '../widgets/auth_text_field.dart';

/// Forgot-password flow. There was no password recovery at all before this.
///
/// Sends a reset email whose link routes through the web `/auth/callback` to the
/// web `/reset-password` page (the same flow the web app uses), then holds on a
/// persistent "check your email" state. Mobile reuses the web reset surface so
/// no in-app deep-link recovery handling is needed.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _email = TextEditingController();
  String? _emailError;
  bool _busy = false;
  bool _sent = false;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    final ok = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email);
    if (!ok) {
      setState(() => _emailError = tr('auth.forgot.emailError'));
      return;
    }
    setState(() {
      _emailError = null;
      _busy = true;
    });
    final locale = context.locale.languageCode;
    final redirect =
        '${Env.apiBaseUrl}/auth/callback?next=${Uri.encodeComponent('/$locale/reset-password')}';
    try {
      // Anti-enumeration: Supabase returns success regardless, so we always
      // advance to the "check your email" state.
      await SupabaseService.client.auth.resetPasswordForEmail(
        email,
        redirectTo: redirect,
      );
    } catch (_) {
      // Swallow — still show the neutral confirmation.
    }
    if (!mounted) return;
    setState(() {
      _busy = false;
      _sent = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Screen(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _BackHeader(onBack: () => Navigator.of(context).maybePop()),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: _sent ? _sentBody() : _formBody(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _formBody() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          tr('auth.forgot.title'),
          textAlign: TextAlign.center,
          style: NhamTextStyles.serifRegular(
            fontSize: NhamFontSize.h3,
          ).copyWith(color: NhamColors.text),
        ),
        const SizedBox(height: 8),
        Text(
          tr('auth.forgot.description'),
          textAlign: TextAlign.center,
          style: NhamTextStyles.sansRegular(
            fontSize: NhamFontSize.sm,
          ).copyWith(color: NhamColors.textMuted, height: 1.5),
        ),
        const SizedBox(height: 20),
        AuthTextField(
          controller: _email,
          label: tr('auth.forgot.email'),
          placeholder: tr('auth.forgot.emailPlaceholder'),
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.email],
          enabled: !_busy,
          errorText: _emailError,
          onSubmitted: (_) => _submit(),
          onChanged: (_) {
            if (_emailError != null) setState(() => _emailError = null);
          },
        ),
        const SizedBox(height: 16),
        AuthSubmitButton(
          label: tr('auth.forgot.submit'),
          busy: _busy,
          loading: _busy,
          onPressed: _submit,
        ),
      ],
    );
  }

  Widget _sentBody() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: Container(
            width: 48,
            height: 48,
            decoration: const BoxDecoration(
              color: Color(0x26C9A87C), // accent @ 15%
              shape: BoxShape.circle,
            ),
            child: const Icon(
              LucideIcons.mailCheck,
              size: 20,
              color: Color(0xFFA88B63),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          tr('auth.forgot.sentTitle'),
          textAlign: TextAlign.center,
          style: NhamTextStyles.serifRegular(
            fontSize: NhamFontSize.h3,
          ).copyWith(color: NhamColors.text),
        ),
        const SizedBox(height: 8),
        Text(
          tr('auth.forgot.sentDescription'),
          textAlign: TextAlign.center,
          style: NhamTextStyles.sansRegular(
            fontSize: NhamFontSize.sm,
          ).copyWith(color: NhamColors.textMuted, height: 1.5),
        ),
        const SizedBox(height: 4),
        Text(
          _email.text.trim(),
          textAlign: TextAlign.center,
          style: NhamTextStyles.serifRegular(
            fontSize: 16,
          ).copyWith(color: NhamColors.text),
        ),
        const SizedBox(height: 24),
        AuthSubmitButton(
          label: tr('auth.forgot.backToSignIn'),
          busy: false,
          loading: false,
          onPressed: () => Navigator.of(context).maybePop(),
        ),
      ],
    );
  }
}

class _BackHeader extends StatelessWidget {
  const _BackHeader({required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Align(
        alignment: Alignment.centerLeft,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onBack,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                LucideIcons.arrowLeft,
                size: 16,
                color: NhamColors.textMuted,
              ),
              const SizedBox(width: 6),
              Text(
                tr('auth.forgot.back'),
                style: NhamTextStyles.sansMedium(
                  fontSize: NhamFontSize.sm,
                ).copyWith(color: NhamColors.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
