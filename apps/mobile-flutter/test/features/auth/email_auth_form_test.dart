import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:kallo_mobile/features/auth/providers/auth_form_controller.dart';
import 'package:kallo_mobile/features/auth/providers/turnstile_controller.dart';
import 'package:kallo_mobile/features/auth/widgets/email_auth_form.dart';
import 'package:kallo_mobile/features/auth/widgets/email_code_view.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';

import '../../l10n_test_loader.dart';

/// Email sign-in is code-only: the address, "Send code", then the 6-digit
/// code. One form signs in and signs up, and nothing asks for a password.
final _provider =
    StateNotifierProvider.autoDispose<AuthFormController, AuthFormState>(
      AuthFormController.new,
    );

class _FakeAuthController extends AuthController {
  // autoRefreshToken off: its ticker outlives the widget tree and trips the
  // test binding's pending-timer invariant.
  _FakeAuthController()
    : super(GoTrueClient(url: 'http://localhost', autoRefreshToken: false));

  final sends = <Map<String, Object?>>[];
  final verifies = <String>[];
  AuthException? sendError;
  AuthException? verifyError;

  @override
  Future<void> sendEmailCode({
    required String email,
    required String emailRedirectTo,
    String? captchaToken,
  }) async {
    sends.add({
      'email': email,
      'redirect': emailRedirectTo,
      'captcha': captchaToken,
    });
    if (sendError != null) throw sendError!;
  }

  @override
  Future<AuthResponse> verifyEmailCode({
    required String email,
    required String code,
  }) async {
    verifies.add('$email:$code');
    if (verifyError != null) throw verifyError!;
    return AuthResponse();
  }
}

/// Hosts the form, or the code view once a code is out — as the screen does.
class _Host extends ConsumerWidget {
  const _Host();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pending = ref.watch(_provider).pendingEmail != null;
    return pending
        ? EmailCodeView(provider: _provider, onNotice: (_) {})
        : EmailAuthForm(provider: _provider);
  }
}

Widget _app(_FakeAuthController auth) => ProviderScope(
  overrides: [
    authControllerProvider.overrideWithValue(auth),
    // A web view needs a platform the test runner does not have.
    turnstileEnabledProvider.overrideWithValue(false),
  ],
  child: EasyLocalization(
    supportedLocales: const [Locale('en')],
    path: 'assets/l10n',
    fallbackLocale: const Locale('en'),
    assetLoader: const FsL10nLoader(),
    child: Builder(
      builder:
          (context) => MaterialApp(
            localizationsDelegates: context.localizationDelegates,
            supportedLocales: context.supportedLocales,
            locale: context.locale,
            home: const Scaffold(body: SingleChildScrollView(child: _Host())),
          ),
    ),
  ),
);

Future<void> _sendCode(WidgetTester tester, String email) async {
  await tester.enterText(find.byType(TextField), email);
  await tester.tap(find.text('Send code'));
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  testWidgets('asks for a code with a locale-carrying redirect, then shows '
      'the code step', (tester) async {
    final auth = _FakeAuthController();
    await tester.pumpWidget(_app(auth));
    await tester.pumpAndSettle();

    expect(find.text('Password'), findsNothing);
    await _sendCode(tester, '  khoi@example.com ');

    expect(auth.sends.single['email'], 'khoi@example.com');
    // The hook writes the email in this locale, and a `next` marks a client
    // that can type a code (old builds sent none and still get a link).
    expect(
      auth.sends.single['redirect'],
      endsWith('/auth/callback?next=%2Fen%2Flogging'),
    );
    expect(find.byType(EmailCodeView), findsOneWidget);
    expect(find.text('khoi@example.com'), findsOneWidget);
    // Unmount, so the resend cooldown's timer is cancelled before the end.
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('refuses an invalid address without a request', (tester) async {
    final auth = _FakeAuthController();
    await tester.pumpWidget(_app(auth));
    await tester.pumpAndSettle();

    await _sendCode(tester, 'not-an-email');

    expect(auth.sends, isEmpty);
    expect(find.text('Enter a valid email address'), findsOneWidget);
  });

  testWidgets('a refused Turnstile token reads as its own line, not a '
      'generic failure', (tester) async {
    final auth =
        _FakeAuthController()
          ..sendError = const AuthException(
            'captcha verification failed',
            statusCode: '400',
            code: 'captcha_failed',
          );
    await tester.pumpWidget(_app(auth));
    await tester.pumpAndSettle();

    await _sendCode(tester, 'khoi@example.com');

    expect(find.byType(EmailCodeView), findsNothing);
    expect(
      find.textContaining("couldn't confirm you're a person"),
      findsOneWidget,
    );
  });

  testWidgets('a code that arrives whole verifies by itself; a wrong one says '
      'so on the field', (tester) async {
    final auth =
        _FakeAuthController()
          ..verifyError = const AuthException(
            'Token has expired or is invalid',
            statusCode: '403',
            code: 'otp_expired',
          );
    await tester.pumpWidget(_app(auth));
    await tester.pumpAndSettle();
    await _sendCode(tester, 'khoi@example.com');

    await tester.enterText(find.byType(TextField), '305805');
    await tester.pumpAndSettle();

    expect(auth.verifies, ['khoi@example.com:305805']);
    expect(
      find.textContaining('That code is wrong or has expired'),
      findsOneWidget,
    );
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('takes any project code length, and never submits a typed code '
      'early', (tester) async {
    final auth = _FakeAuthController();
    await tester.pumpWidget(_app(auth));
    await tester.pumpAndSettle();
    await _sendCode(tester, 'khoi@example.com');

    // Digit by digit, as a person types an 8-digit code.
    var typed = '';
    for (final digit in '12345678'.split('')) {
      typed += digit;
      await tester.enterText(find.byType(TextField), typed);
      await tester.pump();
    }
    expect(auth.verifies, isEmpty);

    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    expect(auth.verifies, ['khoi@example.com:12345678']);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('"Use a different email" goes back to the email form', (
    tester,
  ) async {
    final auth = _FakeAuthController();
    await tester.pumpWidget(_app(auth));
    await tester.pumpAndSettle();
    await _sendCode(tester, 'khoi@example.com');

    await tester.tap(find.text('Use a different email'));
    await tester.pumpAndSettle();

    expect(find.byType(EmailAuthForm), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('holds "Send a new code" for the 60 s cooldown', (tester) async {
    final auth = _FakeAuthController();
    await tester.pumpWidget(_app(auth));
    await tester.pumpAndSettle();
    await _sendCode(tester, 'khoi@example.com');

    expect(find.text('Send a new code in 60s'), findsOneWidget);
    await tester.pump(const Duration(seconds: 60));
    expect(find.text('Send a new code'), findsOneWidget);

    await tester.tap(find.text('Send a new code'));
    await tester.pumpAndSettle();

    expect(auth.sends, hasLength(2));
    expect(find.text('Send a new code in 60s'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
}
