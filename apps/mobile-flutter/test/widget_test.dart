import 'dart:convert';
import 'dart:io';
import 'dart:ui';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kallo_mobile/app.dart';
import 'package:kallo_mobile/services/auth/supabase_service.dart';
import 'package:kallo_mobile/shared/widgets/brand/kallo_wordmark.dart';

/// Serves the l10n JSON from memory. `AssetBundle.loadString` decodes assets
/// larger than 50KB on a background isolate (`compute`), which never completes
/// inside a widget test's fake-async zone — en.json crossed that threshold, so
/// the default asset loader would leave EasyLocalization stuck on an empty
/// frame forever. The files are read with real I/O in `setUpAll` instead.
class _MemoryAssetLoader extends AssetLoader {
  const _MemoryAssetLoader(this.translations);

  final Map<String, Map<String, dynamic>> translations;

  @override
  Future<Map<String, dynamic>?> load(String path, Locale locale) async =>
      translations[locale.languageCode];
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _MemoryAssetLoader assetLoader;

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    // The onboarding draft is read off secure storage on the very first
    // redirect now (it decides where a signed-out user lands), so the channel
    // has to answer or the app never leaves the splash.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
          (call) async => null,
        );
    assetLoader = _MemoryAssetLoader({
      for (final lang in ['en', 'vi'])
        lang:
            jsonDecode(await File('assets/l10n/$lang.json').readAsString())
                as Map<String, dynamic>,
    });
    await EasyLocalization.ensureInitialized();
    await SupabaseService.initialize(
      url: 'https://example.supabase.co',
      anonKey: 'test-anon-key',
    );
  });

  testWidgets('a cold signed-out start lands on /start', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      EasyLocalization(
        supportedLocales: const [Locale('en'), Locale('vi')],
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        assetLoader: assetLoader,
        child: const ProviderScope(child: KalloApp()),
      ),
    );
    await tester.pumpAndSettle();

    // Onboarding now runs BEFORE sign-in (Phase C2), so the first frame of a
    // fresh install is the start screen, not the auth welcome.
    // The brand is the vector wordmark widget now, not a Text node.
    expect(find.byType(KalloWordmark), findsOneWidget);
    expect(find.text('Log meals the way you say them'), findsOneWidget);
    expect(find.text('Get started'), findsOneWidget);
  });

  test('localized user-facing copy uses the Kallo brand', () {
    // Names the retired brand on purpose — do not "modernise" this literal.
    final legacyBrand = RegExp(r'\b(?:Nhẩm|Nham)\b');

    Iterable<String> strings(Object? value) sync* {
      if (value is String) {
        yield value;
      } else if (value is Map) {
        for (final nested in value.values) {
          yield* strings(nested);
        }
      } else if (value is Iterable) {
        for (final nested in value) {
          yield* strings(nested);
        }
      }
    }

    for (final translations in assetLoader.translations.values) {
      expect(
        strings(translations).where(legacyBrand.hasMatch),
        isEmpty,
        reason: 'Localized product copy must use the Kallo brand.',
      );
    }
  });
}
