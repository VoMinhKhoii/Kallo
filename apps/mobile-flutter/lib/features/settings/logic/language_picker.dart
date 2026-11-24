import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../onboarding/providers/onboarding_providers.dart';

/// Language saves on their way to the account. `AccountLanguageSync` stands
/// aside while any is out and looks again once the count drops: the account
/// is mid-change, and what it said before is about to be stale.
final languageSavesProvider = StateProvider<int>((ref) => 0);

/// The one way a language reaches the account, which holds the language push
/// text is written in and the app follows.
///
/// Stored first, shown after: [save] posts the language, waits for the
/// profile to carry it, and only then runs `then` (switching the app). A
/// failed save changes nothing on the phone, so the app never speaks a
/// language the account does not hold.
class LanguagePicker {
  LanguagePicker(this._ref);

  final Ref _ref;

  /// Store [code] on the account, then run [then]. Throws when the save
  /// fails; [then] has not run.
  Future<void> save(String code, {Future<void> Function()? then}) async {
    final saves = _ref.read(languageSavesProvider.notifier);
    saves.state++;
    try {
      await _ref
          .read(saveScreenControllerProvider)
          .save(step: 1, data: {'preferredLocale': code}, advance: false);
      try {
        // The refetch the save started; offline, the sync waits for the next.
        await _ref.read(profileProvider.future);
      } catch (_) {}
      await then?.call();
    } finally {
      saves.state--;
    }
  }
}

final languagePickerProvider = Provider<LanguagePicker>(LanguagePicker.new);
