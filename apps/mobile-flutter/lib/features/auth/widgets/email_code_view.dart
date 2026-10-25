import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../providers/auth_form_controller.dart';
import '../providers/turnstile_controller.dart';
import 'auth_controls.dart';
import 'auth_submit_button.dart';
import 'auth_text_field.dart';
import 'turnstile_view.dart';

/// The code lengths GoTrue can be configured with (`otp_length`, clamped to
/// 6–10). The field takes any of them rather than one fixed length: the hosted
/// dev project sends 8 digits while `supabase/config.toml` says 6, and a field
/// capped below the project's real length would lock every email sign-in out.
/// Mirrors `EMAIL_CODE_MIN_LENGTH` / `EMAIL_CODE_MAX_LENGTH` on the web.
const int kEmailCodeMinLength = 6;
const int kEmailCodeMaxLength = 10;

/// Matches Supabase's per-address cooldown (60 s hosted default): a resend
/// sooner than this is refused upstream, so the button waits it out.
const int kResendCooldownSeconds = 60;

/// The code-entry state that replaces the email form once a code is sent.
///
/// A code that arrives whole — pasted, or filled by iOS from Mail
/// (`AutofillHints.oneTimeCode`) — submits by itself; a typed one submits with
/// Continue, since the length is the project's setting, not something the
/// field can count to. "Send a new code" waits out the cooldown and carries its
/// own Turnstile token; "Use a different email" goes back.
class EmailCodeView extends ConsumerStatefulWidget {
  const EmailCodeView({
    super.key,
    required this.provider,
    required this.onNotice,
  });

  final AutoDisposeStateNotifierProvider<AuthFormController, AuthFormState>
  provider;
  final void Function(String message) onNotice;

  @override
  ConsumerState<EmailCodeView> createState() => _EmailCodeViewState();
}

class _EmailCodeViewState extends ConsumerState<EmailCodeView> {
  final _code = TextEditingController();
  int _previousLength = 0;
  late final _turnstile = TurnstileController(
    enabled: ref.read(turnstileEnabledProvider),
  );
  int _remaining = kResendCooldownSeconds;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startCooldown();
  }

  void _startCooldown() {
    _timer?.cancel();
    _remaining = kResendCooldownSeconds;
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      if (_remaining <= 1) t.cancel();
      setState(() => _remaining = _remaining <= 1 ? 0 : _remaining - 1);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    _turnstile.dispose();
    super.dispose();
  }

  AuthFormController get _controller => ref.read(widget.provider.notifier);

  void _onChanged(String value) {
    _controller.clearMessages();
    // More than one digit in a single change means the code arrived whole.
    final arrivedWhole = value.length - _previousLength > 1;
    _previousLength = value.length;
    if (arrivedWhole && value.length >= kEmailCodeMinLength) {
      _controller.verifyCode(value);
    }
  }

  void _submit() {
    if (_code.text.length >= kEmailCodeMinLength) {
      _controller.verifyCode(_code.text);
    }
  }

  Future<void> _resend() async {
    final token = _turnstile.token;
    _turnstile.reset();
    final sent = await _controller.resendCode(
      locale: context.locale.languageCode,
      captchaToken: token,
    );
    if (!mounted || !sent) return;
    _code.clear();
    _previousLength = 0;
    setState(_startCooldown);
    final notice = ref.read(widget.provider).notice;
    if (notice != null) widget.onNotice(notice);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(widget.provider);
    final busy = state.busy;

    return Column(
      key: const ValueKey('code-view'),
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(tr('auth.code.title'), style: kPageTitle()),
        const SizedBox(height: KalloSpacing.sp2),
        Text(tr('auth.code.sentTo'), style: dashBody(color: kInkMuted)),
        const SizedBox(height: KalloSpacing.sp0_5),
        Text(state.pendingEmail ?? '', style: dashBody(weight: FontWeight.w500)),
        const SizedBox(height: KalloSpacing.sp5),
        AuthTextField(
          controller: _code,
          label: tr('auth.code.label'),
          placeholder: '',
          keyboardType: TextInputType.number,
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.oneTimeCode],
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(kEmailCodeMaxLength),
          ],
          autofocus: true,
          enabled: !busy,
          errorText: state.error,
          onChanged: _onChanged,
          onSubmitted: (_) => _submit(),
        ),
        const SizedBox(height: KalloSpacing.sp3),
        TurnstileView(controller: _turnstile),
        const SizedBox(height: KalloSpacing.sp2),
        ListenableBuilder(
          listenable: _code,
          builder:
              (context, _) => AuthSubmitButton(
                label: tr('auth.code.submit'),
                busy: busy || _code.text.length < kEmailCodeMinLength,
                loading: state.emailBusy,
                onPressed: _submit,
              ),
        ),
        const SizedBox(height: KalloSpacing.sp3),
        ListenableBuilder(
          listenable: _turnstile,
          builder: (context, _) {
            final canResend = _remaining == 0 && !busy && _turnstile.ready;
            return KalloButton(
              title:
                  _remaining > 0
                      ? tr(
                        'auth.code.resendIn',
                        namedArgs: {'seconds': '$_remaining'},
                      )
                      : tr('auth.code.resend'),
              variant: KalloButtonVariant.secondary,
              disabled: !canResend,
              onPressed: _resend,
            );
          },
        ),
        const SizedBox(height: KalloSpacing.sp2),
        Center(
          child: AuthQuietLink(
            label: tr('auth.code.back'),
            onTap: busy ? null : _controller.clearPendingEmail,
          ),
        ),
      ],
    );
  }
}
