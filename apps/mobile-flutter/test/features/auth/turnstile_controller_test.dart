import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/auth/providers/turnstile_controller.dart';
import 'package:kallo_mobile/features/auth/widgets/turnstile_view.dart';

/// The controller reads the messages `app/auth/turnstile/route.ts` posts, and
/// decides when a send may go. A check that could not run never holds the
/// form: the server decides whether a request without a token is accepted.
void main() {
  test('holds the send until a token arrives, then spends it on reset', () {
    var resets = 0;
    final c =
        TurnstileController()..attach(() async {
          resets++;
        });
    expect(c.ready, isFalse);

    c.handleMessage('{"type":"token","token":"tok-1"}');
    expect(c.token, 'tok-1');
    expect(c.ready, isTrue);

    c.reset();
    expect(c.token, isNull);
    expect(c.ready, isFalse);
    expect(resets, 1);
  });

  test('an expired token is dropped; the widget refreshes it by itself', () {
    final c =
        TurnstileController()
          ..handleMessage('{"type":"token","token":"tok-1"}')
          ..handleMessage('{"type":"expired"}');

    expect(c.token, isNull);
    expect(c.ready, isFalse);
  });

  test('a check that cannot run lets the server decide', () {
    final errored =
        TurnstileController()
          ..handleMessage('{"type":"error","code":"script"}');
    final unreachable = TurnstileController()..markFailed();

    expect(errored.ready, isTrue);
    expect(errored.token, isNull);
    expect(unreachable.ready, isTrue);
  });

  test('a server with no site key turns the check off', () {
    final c = TurnstileController()..handleMessage('{"type":"disabled"}');

    expect(c.required, isFalse);
    expect(c.ready, isTrue);
  });

  test('tracks when Cloudflare shows its checkbox', () {
    final c =
        TurnstileController()
          ..handleMessage('{"type":"interactive","on":true}');
    expect(c.interactive, isTrue);

    c.handleMessage('{"type":"interactive","on":false}');
    expect(c.interactive, isFalse);
  });

  test('ignores junk and unknown messages', () {
    final c = TurnstileController();
    var notified = 0;
    c.addListener(() => notified++);

    c
      ..handleMessage('not json')
      ..handleMessage('[1,2]')
      ..handleMessage('{"type":"token","token":""}')
      ..handleMessage('{"type":"mystery"}');

    expect(notified, 0);
    expect(c.token, isNull);
  });

  test('disabled in tests: never required', () {
    expect(TurnstileController(enabled: false).ready, isTrue);
  });

  test(
    'an HTTP error on our page ends the check; one in the widget does not',
    () {
      final page = Uri.parse('https://kallo.fit/auth/turnstile?lang=en');

      // A 403/503 error document never posts a token.
      expect(
        httpErrorEndsTurnstileCheck(
          Uri.parse('https://kallo.fit/auth/turnstile?lang=en&theme=dark'),
          page,
        ),
        isTrue,
      );
      expect(httpErrorEndsTurnstileCheck(null, page), isTrue);
      expect(
        httpErrorEndsTurnstileCheck(
          Uri.parse('https://challenges.cloudflare.com/cdn-cgi/challenge'),
          page,
        ),
        isFalse,
      );
    },
  );
}
