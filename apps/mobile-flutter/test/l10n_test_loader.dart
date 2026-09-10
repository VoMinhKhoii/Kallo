import 'dart:convert';
import 'dart:io';
import 'dart:ui';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
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
