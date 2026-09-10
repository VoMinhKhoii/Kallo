import 'dart:convert';
import 'dart:io';
import 'dart:ui';

import 'package:easy_localization/easy_localization.dart';
// `Localization` and `Translations` are not on the umbrella export.
import 'package:easy_localization/src/localization.dart';
import 'package:easy_localization/src/translations.dart';
import 'package:flutter/services.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:flutter_test/flutter_test.dart';

/// Test-only l10n loader that reads the JSON straight from disk.
///
/// The default loader goes through `rootBundle.loadString`, which hands UTF-8
/// decoding to an isolate for assets over 50 KiB — and isolate replies never
/// arrive inside a widget test's fake-async zone, so `EasyLocalization` stalls
/// forever and `MaterialApp` renders an empty tree. `en.json` crossed that
/// threshold as the app grew; this loader keeps widget tests immune to l10n
/// file size.
class FsL10nLoader extends AssetLoader {
  const FsL10nLoader();

  @override
  Future<Map<String, dynamic>> load(String path, Locale locale) async {
    final file = File('$path/${locale.languageCode}.json');
    return json.decode(file.readAsStringSync()) as Map<String, dynamic>;
  }
}

/// The `setUpAll` every widget test that mounts [EasyLocalization] owes it.
///
/// `ensureInitialized` reads the saved locale through shared_preferences, and
/// the plugin has no platform side under `flutter test` — so the channel is
/// answered with an empty store first, or the read hangs and every string
/// renders as its key.
///
/// Call it from `main()`, after `TestWidgetsFlutterBinding.ensureInitialized()`.
void setUpL10nBinding() {
  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });
}

/// Loads the real `en.json` into `Localization.instance` so `tr()` answers in
/// a PURE test — no widget, no pump.
///
/// The paywall's copy rules (`logic/plan_offer.dart`) are pure functions that
/// happen to call `tr()`, and mounting an `EasyLocalization` just to read a
/// string back would make those cases widget tests again, which is the thing
/// pulling them out of the widget was for.
void setUpTranslations() {
  setUpAll(() async {
    const locale = Locale('en');
    final map = await const FsL10nLoader().load('assets/l10n', locale);
    Localization.load(locale, translations: Translations(map));
    // `DateFormat.MMMd(locale)` throws without this. A widget test gets it
    // from `MaterialApp`'s localization delegates; a pure one has to ask.
    await initializeDateFormatting(locale.languageCode, null);
  });
}
