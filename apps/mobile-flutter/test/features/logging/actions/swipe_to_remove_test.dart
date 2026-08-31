import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/actions/swipe_to_remove.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

import '../../../l10n_test_loader.dart';

const Key _card = ValueKey('card');

Widget _app({VoidCallback? onRemove}) => EasyLocalization(
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
          home: Scaffold(
            body: Center(
              child: SwipeToRemove(
                mealId: 'meal-1',
                onRemove: onRemove,
                builder:
                    (context, radius) => Container(
                      key: _card,
                      height: 80,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFFFF),
                        borderRadius: radius,
                      ),
                    ),
              ),
            ),
          ),
        ),
  ),
);

BoxDecoration _decoration(WidgetTester tester) =>
    tester.widget<Container>(find.byKey(_card)).decoration! as BoxDecoration;

/// A stepped drag: a single move is spent resolving the gesture arena, so no
/// update — and no progress — is ever delivered from one.
Future<TestGesture> _swipeLeft(WidgetTester tester, double dx) async {
  final drag = await tester.startGesture(tester.getCenter(find.byKey(_card)));
  for (var i = 0; i < 12; i++) {
    await drag.moveBy(Offset(-dx / 12, 0));
    await tester.pump(const Duration(milliseconds: 16));
  }
  return drag;
}

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

  testWidgets('at rest the card is fully rounded', (tester) async {
    await tester.pumpWidget(_app(onRemove: () {}));
    await tester.pumpAndSettle();

    final radius = _decoration(tester).borderRadius! as BorderRadius;
    expect(radius.topRight.x, KalloRadii.card);
    expect(radius.topLeft.x, KalloRadii.card);
  });

  testWidgets('the trailing corners square off as the red is uncovered', (
    tester,
  ) async {
    await tester.pumpWidget(_app(onRemove: () {}));
    await tester.pumpAndSettle();

    final drag = await _swipeLeft(tester, 300);

    // The seam the card presents to the removal panel is straight, so the two
    // read as one surface being uncovered rather than two rounded shapes with
    // red showing through the card's corner notches.
    final radius = _decoration(tester).borderRadius! as BorderRadius;
    expect(radius.topRight.x, 0);
    expect(radius.bottomRight.x, 0);
    // The outer edge of the group keeps its shape.
    expect(radius.topLeft.x, KalloRadii.card);
    expect(radius.bottomLeft.x, KalloRadii.card);

    await drag.up();
    await tester.pumpAndSettle();
  });

  testWidgets('the shape comes back when the swipe is abandoned', (
    tester,
  ) async {
    await tester.pumpWidget(_app(onRemove: () {}));
    await tester.pumpAndSettle();

    final drag = await _swipeLeft(tester, 60);
    await drag.up();
    await tester.pumpAndSettle();

    final radius = _decoration(tester).borderRadius! as BorderRadius;
    expect(radius.topRight.x, KalloRadii.card);
  });

  testWidgets('a card that cannot be removed does not swipe', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.byType(Dismissible), findsNothing);

    final left = tester.getTopLeft(find.byKey(_card)).dx;
    final drag = await _swipeLeft(tester, 300);
    expect(tester.getTopLeft(find.byKey(_card)).dx, left);
    await drag.up();
    await tester.pumpAndSettle();
  });
}
