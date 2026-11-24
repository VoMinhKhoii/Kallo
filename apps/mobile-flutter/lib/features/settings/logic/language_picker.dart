import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/auth/session_provider.dart';
import '../../onboarding/providers/onboarding_providers.dart';

/// The one place a language the person picks reaches the account, which
/// holds the language push text is written in and the app follows.
///
/// Every language row (onboarding screen 1, Settings → Region) switches the
/// app first and then calls [pick]. Signed in, the pick is saved at once,
/// whatever page it was made on, and a later pick supersedes one not yet
/// sent. Until the account holds it, the pick is [pending], and
/// `AccountLanguageSync` leaves the app alone instead of switching it back to
/// the language the account still has. Signed out, the onboarding draft
/// carries the language instead.
class LanguagePicker {
  LanguagePicker(this._ref);

  final Ref _ref;
  String? _pending;
  Future<void> _tail = Future.value();

  /// A picked language the account does not hold yet.
  String? get pending => _pending;

  /// Store [code] on the account. Registers the pick at once, so call it
  /// before switching the app. Throws when the save fails; the pick is then
  /// dropped, and the app goes back to the account's language.
  Future<void> pick(String code) {
    if (_ref.read(signedInUserIdProvider) == null) return Future.value();
    _pending = code;
    final run = _tail.then((_) async {
      if (_pending != code) return;
      try {
        await _ref
            .read(saveScreenControllerProvider)
            .save(step: 1, data: {'preferredLocale': code}, advance: false);
      } catch (_) {
        // The save's own profile refetch lands after this, finds nothing
        // pending, and the app returns to the account's language.
        if (_pending == code) _pending = null;
        rethrow;
      }
    });
    _tail = run.catchError((Object _) {});
    return run;
  }

  /// The account now holds [account]; a pick it matches is done.
  void settle(String account) {
    if (_pending == account) _pending = null;
  }
}

final languagePickerProvider = Provider<LanguagePicker>(LanguagePicker.new);
