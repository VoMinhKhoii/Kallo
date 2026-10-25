import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Whether email forms run a Turnstile check at all. Always true in the app;
/// widget tests override it to false, since a web view needs a platform the
/// test runner does not have.
final turnstileEnabledProvider = Provider<bool>((ref) => true);

/// The state of one Cloudflare Turnstile widget, fed by the messages the
/// `/auth/turnstile` page posts over its JavaScript channel (see
/// `app/auth/turnstile/route.ts` on the web side, and [TurnstileView]).
///
/// The token proves to our auth proxy that a person asked for a sign-in code.
/// It is single-use, so the form calls [reset] after every send.
class TurnstileController extends ChangeNotifier {
  TurnstileController({bool enabled = true}) : _required = enabled;

  bool _required;
  String? _token;
  bool _failed = false;
  bool _interactive = false;
  Future<void> Function()? _resetPage;

  /// False when the check is off — in tests, or when the server has no site
  /// key — so sends go without a token.
  bool get required => _required;

  /// The current token, or null while the check runs.
  String? get token => _token;

  /// The check could not run (page unreachable, script blocked, error).
  bool get failed => _failed;

  /// Cloudflare is showing its checkbox, so the widget needs room.
  bool get interactive => _interactive;

  /// Whether a send may go now. A check that could not run does not hold the
  /// form: the server decides, and while it only monitors it accepts the
  /// request; once it enforces, it refuses with `captcha_failed`.
  bool get ready => !_required || _token != null || _failed;

  /// One JSON message from the page. Unknown or malformed ones are ignored.
  void handleMessage(String raw) {
    final Object? decoded;
    try {
      decoded = jsonDecode(raw);
    } on FormatException {
      return;
    }
    if (decoded is! Map) return;
    switch (decoded['type']) {
      case 'token':
        final token = decoded['token'];
        if (token is! String || token.isEmpty) return;
        _token = token;
        _failed = false;
      case 'expired':
        _token = null;
      case 'error':
        _token = null;
        _failed = true;
      case 'interactive':
        _interactive = decoded['on'] == true;
      case 'disabled':
        _required = false;
      default:
        return;
    }
    notifyListeners();
  }

  /// The page itself could not load.
  void markFailed() {
    if (_failed) return;
    _failed = true;
    notifyListeners();
  }

  /// Spend the current token and ask the widget for a fresh one.
  void reset() {
    _token = null;
    notifyListeners();
    _resetPage?.call();
  }

  /// Wired by [TurnstileView] once its page is loading.
  void attach(Future<void> Function() resetPage) => _resetPage = resetPage;

  void detach() => _resetPage = null;
}
