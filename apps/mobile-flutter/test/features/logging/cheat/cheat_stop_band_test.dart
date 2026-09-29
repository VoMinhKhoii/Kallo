import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/cheat/cheat_slider_card.dart';
import 'package:kallo_mobile/models/logging/cheat.dart';

import '../../../app_fonts.dart';
import '../../../l10n_test_loader.dart';

Widget _wrap(Widget child, double scale) => EasyLocalization(
  supportedLocales: const [Locale('en'), Locale('vi')],
  path: 'assets/l10n',
  fallbackLocale: const Locale('en'),
  assetLoader: const FsL10nLoader(),
  child: Builder(
    builder:
        (context) => MaterialApp(
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: context.locale,
          builder:
              (context, child) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(textScaler: TextScaler.linear(scale)),
                child: child!,
              ),
          home: Scaffold(body: SingleChildScrollView(child: child)),
        ),
  ),
);

// Long Vietnamese stop labels, as the model writes them for a seafood hotpot.
// Each wraps to three lines in the 84pt label column.
const _labels = [
  'Chỉ vài miếng hải sản nhỏ',
  'Một ít tôm mực lác đác',
  'Lượng hải sản vừa phải',
  'Nhiều tôm mực và cá viên',
  'Rất nhiều hải sản các loại',
  'Đại tiệc hải sản khổng lồ',
];

CheatSlider _slider(CheatSliderKey key, String title) => CheatSlider(
  key: key,
  label: title,
  defaultLevel: 5,
  anchors: [
    for (final (i, label) in _labels.indexed)
      CheatSliderAnchor(level: i * 2.0, label: '$label ($title)'),
  ],
);

const _first = 'Hải sản & Thịt';
const _second = 'Bún, Mì & Rau củ';

final _spec = CheatSliderSpec(
  mealSlot: 'dinner',
  confidence: 'medium',
  sliders: [
    _slider(CheatSliderKey.protein, _first),
    _slider(CheatSliderKey.carbs, _second),
  ],
);

Rect _titleRow(WidgetTester tester, String title) => tester.getRect(
  find.ancestor(of: find.text(title), matching: find.byType(Row)).first,
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
    await loadAppFonts();
  });

  for (final scale in const [1.0, 1.3]) {
    testWidgets('stop labels clear both section titles at text scale $scale', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(440, 1400));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        _wrap(
          CheatSliderCard(spec: _spec, rawInput: 'lẩu', onConfirm: (_) {}),
          scale,
        ),
      );
      await tester.pumpAndSettle();

      final firstTitle = _titleRow(tester, _first);
      final secondTitle = _titleRow(tester, _second);

      for (final (i, label) in _labels.indexed) {
        final rect = tester.getRect(find.text('$label ($_first)'));
        // The premise: every label really wraps to three lines.
        expect(rect.height, greaterThan(firstTitle.height * 2));
        if (i.isEven) {
          // Top band: must stay below this slider's title row.
          expect(
            rect.top,
            greaterThanOrEqualTo(firstTitle.bottom),
            reason: 'top label "$label" overlaps "$_first"',
          );
        } else {
          // Bottom band: must stay above the next slider's title row.
          expect(
            rect.bottom,
            lessThanOrEqualTo(secondTitle.top),
            reason: 'bottom label "$label" overlaps "$_second"',
          );
        }
      }
    });
  }
}
