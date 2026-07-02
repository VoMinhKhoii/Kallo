import 'dart:convert';
import 'dart:io';
import 'dart:ui';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:nham_mobile/app.dart';
import 'package:nham_mobile/services/supabase_service.dart';

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

  testWidgets('branded auth welcome renders', (WidgetTester tester) async {
    await tester.pumpWidget(
      EasyLocalization(
        supportedLocales: const [Locale('en'), Locale('vi')],
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        assetLoader: assetLoader,
        child: const ProviderScope(child: NhamApp()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Nhẩm'), findsOneWidget);
    expect(
      find.text('Track Vietnamese meals without the guesswork'),
      findsOneWidget,
    );
  });
}
