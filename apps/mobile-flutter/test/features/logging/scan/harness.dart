import 'dart:convert';
import 'dart:io';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'package:kallo_mobile/features/logging/data/label_scan_providers.dart';
import 'package:kallo_mobile/features/logging/logic/label/image.dart';
import 'package:kallo_mobile/features/logging/logic/relog/scan_purpose.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/scan/camera/controls.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/scan/editor/field.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/scan/screen.dart';
import 'package:kallo_mobile/features/privacy/data/ai_consent_providers.dart';
import 'package:kallo_mobile/models/http/api_error.dart';
import 'package:kallo_mobile/models/logging/scan_outcome.dart';
import 'package:kallo_mobile/services/billing/entitlement_state.dart';
import 'package:kallo_mobile/services/billing/feature_lock.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import '../../../app_fonts.dart';
import '../../../l10n_test_loader.dart';
import 'fake_scanner_platform.dart';

/// Coco Xim coconut water, as `/api/v1/barcode/search` returns it: a liquid,
/// per 100 ml, with a 100 ml serving in a 1 L pack.
const coconutWaterJson = <String, dynamic>{
  'barcode': '8938507849131',
  'name': 'Coconut Water',
  'brand': 'Coco Xim',
  'caloriesKcal': 16,
  'proteinG': 0,
  'carbohydrateG': 4,
  'fatG': 0,
  'sodiumMg': 39,
  'servingSizeG': 100,
  'packageSizeG': 1000,
  'amountUnit': 'ml',
  'micronutrients': {'calciumMg': 10, 'potassiumMg': 170},
};

/// A biscuit label as `/api/v1/nutrition-label/scan` reads it: per 100 g,
/// a 30 g serving, five to the pack.
const biscuitLabelJson = <String, dynamic>{
  'basis': 'per_100g',
  'confidence': 'high',
  'labelEvidence': 'Thông tin dinh dưỡng',
  'productName': 'Bánh quy Cosy',
  'servingSize': {'value': 30, 'unit': 'g'},
  'servingsPerContainer': 5,
  'per100g': {
    'calories': 480,
    'proteinGrams': 6,
    'carbsGrams': 62,
    'fatGrams': 22,
    'sodiumMg': 320,
  },
};

ApiError apiError(String code, int status) =>
    ApiError(code, status, false, code);

/// Records every request; answers from [handler], which may throw an
/// [ApiError] or return a Future to hold a request open.
class ScanApi extends ApiClient {
  final List<(String, String, Object?)> requests = [];
  Object? Function(String method, String path, Object? body) handler =
      (_, _, _) => <String, dynamic>{};

  List<Object?> bodiesTo(String path) => [
    for (final r in requests)
      if (r.$2 == path) r.$3,
  ];

  @override
  Future<T> get<T>(String path) async {
    requests.add(('GET', path, null));
    final answer = handler('GET', path, null);
    return (answer is Future ? await answer : answer) as T;
  }

  @override
  Future<T> post<T>(String path, [Object? body]) async {
    requests.add(('POST', path, body));
    final answer = handler('POST', path, body);
    return (answer is Future ? await answer : answer) as T;
  }
}

/// A 1x1 PNG on disk — what the library picker hands back.
LabelImage labelPhoto() {
  final bytes = base64Decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwAD'
    'hgGAWjR9awAAAABJRU5ErkJggg==',
  );
  final file = File('${Directory.systemTemp.createTempSync().path}/label.png')
    ..writeAsBytesSync(bytes);
  return LabelImage(bytes: bytes, mimeType: 'image/png', path: file.path);
}

void setUpScanTests() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
    // Real glyph widths: the placeholder font's 1em boxes overflow rows that
    // fit on a phone (test/AGENTS.md, "Measuring text width").
    await loadAppFonts();
  });
}

/// The scan screen pushed from a host page, as the app opens it, with the
/// camera, the network, the entitlement and AI consent all faked.
class ScanHarness {
  ScanHarness(
    this.tester, {
    this.purpose = ScanPurpose.log,
    this.locked = false,
  });

  final WidgetTester tester;
  final ScanPurpose purpose;

  /// A free account: label scan, Edit and Enter manually go to the paywall.
  final bool locked;

  final api = ScanApi();
  final scanner = FakeScannerPlatform();
  LabelImageResult pickResult = LabelImageResult.success(labelPhoto());

  /// What the library picker answers; replace it to hold a pick open.
  late Future<LabelImageResult> Function() picker = () async => pickResult;

  /// What the screen popped with; [closed] once it has popped at all.
  ScanOutcome? outcome;
  bool closed = false;

  Future<void> open() async {
    // An iPhone 16's 390 x 844 — the panel heights are fractions of it.
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    MobileScannerPlatform.instance = scanner;
    addTearDown(scanner.barcodes.close);
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder:
              (context, _) => Scaffold(
                body: Center(
                  child: TextButton(
                    onPressed: () async {
                      outcome = await showScanScreen(
                        context,
                        userId: 'user-1',
                        date: '2026-09-28',
                        purpose: purpose,
                      );
                      closed = true;
                    },
                    child: const Text('open'),
                  ),
                ),
              ),
        ),
        GoRoute(
          path: '/paywall',
          builder: (_, _) => const Scaffold(body: Text('paywall-route')),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          premiumLockProvider(
            PremiumFeature.labelScan,
          ).overrideWithValue(locked),
          aiConsentProvider.overrideWithValue(true),
          labelImageCaptureProvider.overrideWithValue((_) => picker()),
        ],
        child: EasyLocalization(
          supportedLocales: const [Locale('en')],
          path: 'assets/l10n',
          fallbackLocale: const Locale('en'),
          assetLoader: const FsL10nLoader(),
          child: Builder(
            builder:
                (context) => MaterialApp.router(
                  routerConfig: router,
                  localizationsDelegates: context.localizationDelegates,
                  supportedLocales: context.supportedLocales,
                  locale: context.locale,
                ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.byType(ScanScreen), findsOneWidget);
  }

  /// A code crosses the scan window, and the lookup answers.
  Future<void> detect(String code) async {
    scanner.detect(code);
    await tester.pumpAndSettle();
  }

  Future<void> tapText(String text) async {
    await tester.tap(find.text(text).last);
    await tester.pumpAndSettle();
  }

  Future<void> tapLabel(String semanticsLabel) async {
    await tester.tap(find.bySemanticsLabel(semanticsLabel).last);
    await tester.pumpAndSettle();
  }

  /// The editor's field for the nutrient labelled [label] ("Calories").
  Finder field(String label) => find.descendant(
    of: find.widgetWithText(ScanEditorField, label),
    matching: find.byType(CupertinoTextField),
  );

  Future<void> type(String label, String text) async {
    await tester.ensureVisible(field(label));
    await tester.enterText(field(label), text);
    await tester.pumpAndSettle();
  }

  /// The live camera's tools are up — no panel, no spinner over them.
  bool get cameraIsLive =>
      find.byType(ScanCameraControls).evaluate().isNotEmpty;
}
