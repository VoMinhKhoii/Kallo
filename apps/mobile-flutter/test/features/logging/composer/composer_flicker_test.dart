import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/composer/composer_action_row.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/composer_card_surface.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/composer_dock.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/meal_input.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/meal_input_controls.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_screen.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

import '../../../l10n_test_loader.dart';

/// Tapping the feed's background to dismiss the keyboard must not make the
/// COMPOSER CARD flicker. Focus loss and the keyboard's ~250ms retract land in
/// the same window, so anything the card derives from BOTH can settle twice —
/// once for the focus flip and once for the inset — and the second settle is
/// the flicker the user sees.
const Size _screen = Size(390, 844);
const double _indicator = 34;
const double _keyboard = 300;

void _setInset(WidgetTester tester, double inset) {
  tester.view.physicalSize = _screen;
  tester.view.devicePixelRatio = 1.0;
  tester.view.viewInsets = FakeViewPadding(bottom: inset);
  tester.view.viewPadding = const FakeViewPadding(bottom: _indicator);
  tester.view.padding = FakeViewPadding(
    bottom: inset >= _indicator ? 0 : _indicator - inset,
  );
}

/// One frame of what the card LOOKS like, as the eye would read it.
class _Frame {
  _Frame({
    required this.inset,
    required this.rect,
    required this.border,
    required this.glow,
    required this.controls,
  });

  final double inset;
  final Rect rect;
  final Color border;
  final double glow;
  final Set<String> controls;

  /// What the eye reads: the ring composited over the card it sits on. A
  /// half-transparent border is never seen at its own value — only over the
  /// white card — so this, not the raw alpha, is the ring's appearance.
  double get ringLuminance {
    Color over(Color c) => Color.alphaBlend(c, KalloColors.elev);
    return over(border).computeLuminance();
  }

  @override
  String toString() =>
      'inset=${inset.toStringAsFixed(0)} '
      'h=${rect.height.toStringAsFixed(1)} '
      'top=${rect.top.toStringAsFixed(1)} '
      'border=0x${border.toARGB32().toRadixString(16).padLeft(8, '0')} '
      'ring=${ringLuminance.toStringAsFixed(4)} '
      'glow=${glow.toStringAsFixed(3)} '
      'controls=${controls.toList()..sort()}';
}

_Frame _sample(WidgetTester tester, double inset) {
  final surface = find.byType(ComposerCardSurface);
  final box = tester.widget<Container>(
    find.descendant(of: surface, matching: find.byType(Container)).first,
  );
  final decoration = box.decoration! as BoxDecoration;
  return _Frame(
    inset: inset,
    rect: tester.getRect(surface),
    border: decoration.border!.top.color,
    glow: decoration.boxShadow!.first.color.a,
    controls: <String>{
      if (tester.any(find.byType(ComposerModeButton))) 'mode',
      if (tester.any(find.byType(ComposerBarcodeButton))) 'scan',
      if (tester.any(find.byType(ComposerActionButton))) 'send',
    },
  );
}

Widget _host(MealInputController controller) => EasyLocalization(
  supportedLocales: const [Locale('en')],
  path: 'assets/l10n',
  fallbackLocale: const Locale('en'),
  assetLoader: const FsL10nLoader(),
  child: Builder(
    builder:
        (context) => MaterialApp(
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: context.locale,
          home: Screen(
            bottom: false,
            child: Stack(
              children: [
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: ComposerDock(
                    onHeightChanged: (_) {},
                    child: MealInput(
                      controller: controller,
                      onSubmit: (_) {},
                      onModePressed: () {},
                      onBarcodePressed: () {},
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
  ),
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
  });

  testWidgets('the composer card settles once when the keyboard is dismissed', (
    tester,
  ) async {
    addTearDown(tester.view.reset);
    _setInset(tester, 0);
    final controller = MealInputController();
    await tester.pumpWidget(_host(controller));
    await tester.pumpAndSettle();

    // Focus, then let the keyboard finish arriving.
    await tester.tap(find.byType(TextField));
    _setInset(tester, _keyboard);
    await tester.pumpAndSettle();

    // The tap-anywhere-to-unfocus gesture the logging screen carries, then the
    // ~250ms iOS retract ramp, sampled the way the engine delivers it.
    FocusManager.instance.primaryFocus?.unfocus();
    final frames = <_Frame>[];
    for (var i = 10; i >= 0; i--) {
      final inset = _keyboard * i / 10;
      _setInset(tester, inset);
      await tester.pump(const Duration(milliseconds: 25));
      frames.add(_sample(tester, inset));
    }
    await tester.pumpAndSettle();
    frames.add(_sample(tester, 0));

    final trace = frames.join('\n');

    // 1. The card's own height must never move: nothing about focus changes
    //    what the card contains.
    final heights = frames.map((f) => f.rect.height).toSet();
    expect(
      heights.length,
      1,
      reason: 'the card changed height during the dismiss:\n$trace',
    );

    // 2. The focus ring withdraws ONCE. Alpha alone is not the test — the ring
    //    is only ever seen composited over the white card, so the thing that
    //    has to move in one direction is that composite. A ring that deepens
    //    before it disappears is the card changing appearance twice on one
    //    dismiss, which is exactly what the eye reads as a flicker.
    for (var i = 1; i < frames.length; i++) {
      expect(
        frames[i].ringLuminance,
        greaterThanOrEqualTo(frames[i - 1].ringLuminance - 1e-6),
        reason: 'the focus ring got DARKER while withdrawing, at frame $i:'
            '\n$trace',
      );
      expect(
        frames[i].glow,
        lessThanOrEqualTo(frames[i - 1].glow + 1e-6),
        reason: 'the focus glow brightened again at frame $i:\n$trace',
      );
    }
    expect(
      frames.last.border.a,
      closeTo(0, 1e-6),
      reason: 'the focus ring never finished fading out:\n$trace',
    );

    // ...and only its ALPHA moves. Fading a tinted border toward a transparent
    // BLACK drags its RGB down to black on the way, which is what produces the
    // deepening above; the ring must stay the token's tan at every frame.
    for (final frame in frames) {
      if (frame.border.a < 1e-3) continue;
      expect(
        <double>[frame.border.r, frame.border.g, frame.border.b],
        <Matcher>[
          closeTo(KalloColors.accent.r, 1e-3),
          closeTo(KalloColors.accent.g, 1e-3),
          closeTo(KalloColors.accent.b, 1e-3),
        ],
        reason: 'the focus ring left its own colour mid-fade:\n$trace',
      );
    }

    // 3. Nothing on the action row may appear or disappear.
    expect(
      frames.map((f) => f.controls.join(',')).toSet().length,
      1,
      reason: 'the action row changed shape during the dismiss:\n$trace',
    );

    // 4. The card must travel with the keyboard and never reverse — a card
    //    that steps down and back up is the flicker in its most visible form.
    for (var i = 1; i < frames.length; i++) {
      expect(
        frames[i].rect.top,
        greaterThanOrEqualTo(frames[i - 1].rect.top - 1e-6),
        reason: 'the card moved back UP at frame $i:\n$trace',
      );
    }
  });
}
