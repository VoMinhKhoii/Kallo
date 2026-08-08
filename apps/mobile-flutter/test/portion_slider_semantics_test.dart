import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:nham_mobile/features/logging/widgets/portion/portion_picker_sheet.dart';
import 'package:nham_mobile/models/vessel.dart';

import 'l10n_test_loader.dart';

/// The picker's slider must be OPERABLE by assistive technology, not merely
/// readable by it.
///
/// It shipped announced-but-inert: an outer `Semantics(..., excludeSemantics:
/// true)` discarded the Material Slider's whole semantics subtree, taking its
/// increase/decrease actions with it. A VoiceOver user could focus the control
/// and hear "150 g — medium cut", then swipe up and have nothing happen. The
/// web original is a Radix slider that is fully keyboard- and AT-adjustable,
/// so this was a whole interaction mode silently dropped in the port — and the
/// kind of thing no visual check and no `flutter analyze` will ever surface.
///
/// Asserting the ACTIONS (not just the label) is the point of this file.

Widget _wrap(Widget child) => EasyLocalization(
  supportedLocales: const [Locale('en'), Locale('vi')],
  path: 'assets/l10n',
  fallbackLocale: const Locale('en'),
  assetLoader: const FsL10nLoader(),
  child: Builder(
    builder: (context) => MaterialApp(
      localizationsDelegates: context.localizationDelegates,
      supportedLocales: context.supportedLocales,
      locale: context.locale,
      home: Scaffold(body: child),
    ),
  ),
);

/// The one node flagged `isSlider` in the tree.
final _slider = find.semantics.byFlag(SemanticsFlag.isSlider);

/// Resolve through the FLAG finder, not `find.byType(Slider)` — the latter maps
/// the Slider element to its nearest enclosing semantics node, which is the
/// label wrapper, not the slider node that carries the value and the actions.
SemanticsNode _sliderNode(WidgetTester tester) {
  final nodes = _slider.evaluate().toList();
  expect(nodes, hasLength(1), reason: 'expected exactly one slider node');
  return nodes.single;
}

Future<void> _openPicker(WidgetTester tester, ClientVessel vessel, int grams) async {
  await tester.pumpWidget(
    _wrap(
      Builder(
        builder: (context) => TextButton(
          onPressed: () => showPortionPicker(
            context,
            vessel: vessel,
            grams: grams,
            itemCalories: 300,
            itemQuantity: 150,
          ),
          child: const Text('open'),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
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

  for (final (name, vessel) in [
    ('piece ruler', const PieceVessel(tier: 3, count: 1, kind: PieceKind.fish)),
    (
      'container',
      const ContainerVessel(
        family: ContainerFamily.bowl,
        tier: 2,
        dishClass: DishClass.soup,
      ),
    ),
  ]) {
    testWidgets('$name slider exposes increase/decrease to AT', (tester) async {
      final handle = tester.ensureSemantics();
      await _openPicker(tester, vessel, 150);

      final data = _sliderNode(tester).getSemanticsData();
      expect(
        data.hasAction(SemanticsAction.increase),
        isTrue,
        reason: '$name slider cannot be raised by a screen reader',
      );
      expect(
        data.hasAction(SemanticsAction.decrease),
        isTrue,
        reason: '$name slider cannot be lowered by a screen reader',
      );
      // The value must still read as grams, not as a raw slider position.
      expect(data.value, contains('g'));
      handle.dispose();
    });

    testWidgets('$name slider actually moves on an AT increase', (tester) async {
      final handle = tester.ensureSemantics();
      await _openPicker(tester, vessel, 150);

      final before = _sliderNode(tester).getSemanticsData().value;
      // `increase` itself asserts the action is supported — this is the
      // screen-reader gesture, not a synthetic tap on the track.
      tester.semantics.increase(_slider);
      await tester.pumpAndSettle();
      final after = _sliderNode(tester).getSemanticsData().value;

      expect(
        after,
        isNot(before),
        reason: 'an AT increase left the $name portion unchanged',
      );
      handle.dispose();
    });
  }

  testWidgets('the label rides above the slider node, not on it', (tester) async {
    final handle = tester.ensureSemantics();
    await _openPicker(
      tester,
      const PieceVessel(tier: 3, count: 1, kind: PieceKind.fish),
      150,
    );
    // "Portion size" must be announced somewhere in the slider's ancestry —
    // an unlabelled slider is just "150 g — medium cut" with no subject.
    expect(
      find.bySemanticsLabel('Portion size'),
      findsWidgets,
      reason: 'slider lost its accessible name',
    );
    handle.dispose();
  });
}
