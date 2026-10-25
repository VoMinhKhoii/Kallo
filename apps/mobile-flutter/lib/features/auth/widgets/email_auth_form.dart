import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../providers/auth_form_controller.dart';
import '../providers/turnstile_controller.dart';
import 'auth_submit_button.dart';
import 'auth_text_field.dart';
import 'turnstile_view.dart';

/// The single email path, reached from the welcome screen's "Continue with
/// email": the address, then "Send code". The same form signs in an existing
/// account and creates a new one — the code decides nothing about which, so
/// there is no sign-up mode and no password.
///
/// The form only — its chrome (the wordmark row with the back chevron, the
/// page title, the social options under it) belongs to [EmailAuthScreen], the
/// route that hosts it. Once the code is sent the screen swaps this for
/// [EmailCodeView].
class EmailAuthForm extends ConsumerStatefulWidget {
  const EmailAuthForm({super.key, required this.provider});

  final AutoDisposeStateNotifierProvider<AuthFormController, AuthFormState>
  provider;

  @override
  ConsumerState<EmailAuthForm> createState() => _EmailAuthFormState();
}

class _EmailAuthFormState extends ConsumerState<EmailAuthForm> {
  final _email = TextEditingController();
  late final _turnstile = TurnstileController(
    enabled: ref.read(turnstileEnabledProvider),
  );
  String? _emailError;

  @override
  void dispose() {
    _email.dispose();
    _turnstile.dispose();
    super.dispose();
  }

  AuthFormController get _controller => ref.read(widget.provider.notifier);

  bool _validate() {
    final email = _email.text.trim();
    final ok = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email);
    setState(() => _emailError = ok ? null : tr('auth.signIn.emailError'));
    return ok;
  }

  Future<void> _submit() async {
    if (!_validate() || !_turnstile.ready) return;
    final token = _turnstile.token;
    // Spent either way: Turnstile tokens are single-use.
    _turnstile.reset();
    await _controller.sendCode(
      email: _email.text,
      locale: context.locale.languageCode,
      captchaToken: token,
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(widget.provider);
    final busy = state.busy;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AuthTextField(
          controller: _email,
          label: tr('auth.signIn.email'),
          placeholder: tr('auth.signIn.emailPlaceholder'),
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.email],
          onSubmitted: (_) => _submit(),
          enabled: !busy,
          errorText: _emailError,
          onChanged: (_) {
            if (_emailError != null) setState(() => _emailError = null);
            _controller.clearMessages();
          },
        ),
        // Inline auth error — stays put (unlike a toast) and the field keeps
        // its value so the user can correct and retry in place.
        if (state.error != null) ...[
          const SizedBox(height: KalloSpacing.sp3),
          Text(state.error!, style: dashMeta(color: KalloColors.danger)),
        ],
        const SizedBox(height: KalloSpacing.sp3),
        TurnstileView(controller: _turnstile),
        const SizedBox(height: KalloSpacing.sp2),
        ListenableBuilder(
          listenable: _turnstile,
          builder:
              (context, _) => AuthSubmitButton(
                label: tr('auth.email.sendCode'),
                // Held only while the check is still producing a token.
                busy: busy || !_turnstile.ready,
                loading: state.emailBusy,
                onPressed: _submit,
              ),
        ),
      ],
    );
  }
}
