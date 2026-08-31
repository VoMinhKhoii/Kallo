import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../services/env/env.dart';
import '../../../services/auth/supabase_service.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../../theme/kallo_typography.dart';
import '../widgets/auth_controls.dart';

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
              padding: const EdgeInsets.symmetric(
                horizontal: kAuthInset,
                vertical: KalloSpacing.sp6,
              ),
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
          style: KalloTextStyles.serifRegular(
            fontSize: kAuthHeading,
          ).copyWith(color: KalloColors.text, letterSpacing: -0.4),
        ),
        const SizedBox(height: KalloSpacing.sp2),
        Text(
          tr('auth.forgot.description'),
          textAlign: TextAlign.center,
          style: dashBody(color: kInkMuted),
        ),
        const SizedBox(height: KalloSpacing.sp5),
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
        const SizedBox(height: KalloSpacing.sp4),
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
            width: 56,
            height: 56,
            decoration: const BoxDecoration(
              color: KalloColors.hover,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              LucideIcons.mailCheck300,
              size: KalloIcons.size,
              color: KalloColors.textMuted,
            ),
          ),
        ),
        const SizedBox(height: KalloSpacing.sp5),
        Text(
          tr('auth.forgot.sentTitle'),
          textAlign: TextAlign.center,
          style: KalloTextStyles.serifRegular(
            fontSize: kAuthHeading,
          ).copyWith(color: KalloColors.text, letterSpacing: -0.4),
        ),
        const SizedBox(height: KalloSpacing.sp2),
        Text(
          tr('auth.forgot.sentDescription'),
          textAlign: TextAlign.center,
          style: dashBody(color: kInkMuted),
        ),
        const SizedBox(height: KalloSpacing.sp0_5),
        Text(
          _email.text.trim(),
          textAlign: TextAlign.center,
          style: dashBody(weight: FontWeight.w500),
        ),
        const SizedBox(height: KalloSpacing.sp6),
        // Quiet, not the black CTA: the mail is already sent, so this is a way
        // back rather than the commitment the CTA tier is reserved for.
        KalloButton(
          title: tr('auth.forgot.backToSignIn'),
          variant: KalloButtonVariant.secondary,
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
      padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp1),
      child: Align(
        alignment: Alignment.centerLeft,
        child: AuthBackButton(onBack: onBack),
      ),
    );
  }
}
