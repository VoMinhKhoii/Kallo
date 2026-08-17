import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/form/option_strip.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

/// Onboarding and settings shipped independently drifted copies of this
/// segmented control. Consolidating them kept BOTH looks behind
/// [OptionStripSkin] rather than picking one, because both are on screen.
///
/// Each claim below names the copy it came from. A later change that quietly
/// unifies a skin — the obvious "cleanup" here — fails one of these.

const _options = [
  OptionStripItem(value: 'a', label: 'Alpha', hint: 'first'),
  OptionStripItem(value: 'b', label: 'Beta'),
];

Future<void> _pump(
  WidgetTester tester,
  OptionStripSkin skin, {
  String value = 'a',
  ValueChanged<String>? onChange,
  List<OptionStripItem> options = _options,
}) => tester.pumpWidget(
  Directionality(
    textDirection: TextDirection.ltr,
    child: Center(
      child: SizedBox(
        width: 300,
        child: skin == OptionStripSkin.settings
            ? OptionStrip.settings(
                options: options,
                value: value,
                onChange: onChange ?? (_) {},
              )
            : OptionStrip.onboarding(
                options: options,
                value: value,
                onChange: onChange ?? (_) {},
              ),
      ),
    ),
  ),
);

AnimatedContainer _chip(WidgetTester tester, String label) =>
    tester.widget<AnimatedContainer>(
      find.ancestor(
        of: find.text(label),
        matching: find.byType(AnimatedContainer),
      ),
    );

Text _hint(WidgetTester tester) => tester.widget<Text>(find.text('first'));

void main() {
  group('shared by both skins', () {
    testWidgets('reports the tapped option', (tester) async {
      String? picked;
      await _pump(
        tester,
        OptionStripSkin.onboarding,
        onChange: (v) => picked = v,
      );
      await tester.tap(find.text('Beta'));
      expect(picked, 'b');
    });

    testWidgets('lifts only the active segment onto the elev chip', (
      tester,
    ) async {
      await _pump(tester, OptionStripSkin.settings);
      final active = _chip(tester, 'Alpha').decoration! as BoxDecoration;
      final idle = _chip(tester, 'Beta').decoration! as BoxDecoration;
      expect(active.boxShadow, isNotNull);
      expect(idle.boxShadow, isNull);
    });

    testWidgets('renders a leading icon when the option carries one', (
      tester,
    ) async {
      await _pump(
        tester,
        OptionStripSkin.onboarding,
        options: const [
          OptionStripItem(value: 'a', label: 'Alpha', icon: Icons.star),
        ],
      );
      expect(find.byIcon(Icons.star), findsOneWidget);
    });
  });

  group('the onboarding skin', () {
    testWidgets('pads each segment on both axes and sizes it to itself', (
      tester,
    ) async {
      await _pump(tester, OptionStripSkin.onboarding);
      expect(
        _chip(tester, 'Alpha').padding,
        const EdgeInsets.symmetric(
          horizontal: KalloSpacing.sp2,
          vertical: KalloSpacing.sp2_5,
        ),
      );
      expect(find.byType(IntrinsicHeight), findsNothing);
    });

    testWidgets('eases the chip transition rather than running it linearly', (
      tester,
    ) async {
      await _pump(tester, OptionStripSkin.onboarding);
      expect(_chip(tester, 'Alpha').curve, const Cubic(0.25, 0.1, 0.25, 1));
    });

    testWidgets('clamps the hint to two lines', (tester) async {
      await _pump(tester, OptionStripSkin.onboarding);
      expect(_hint(tester).maxLines, 2);
      expect(_hint(tester).overflow, TextOverflow.ellipsis);
    });

    testWidgets('stays out of the a11y tree as a button', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester, OptionStripSkin.onboarding);
      expect(find.bySemanticsLabel('Alpha, first'), findsNothing);
      handle.dispose();
    });
  });

  group('the settings skin', () {
    testWidgets('stretches every segment to the tallest and pads vertically', (
      tester,
    ) async {
      await _pump(tester, OptionStripSkin.settings);
      expect(find.byType(IntrinsicHeight), findsOneWidget);
      expect(
        _chip(tester, 'Alpha').padding,
        const EdgeInsets.symmetric(vertical: KalloSpacing.sp2),
      );
      // The hinted option and the bare one end up the same height.
      expect(
        tester.getSize(find.byWidget(_chip(tester, 'Alpha'))).height,
        tester.getSize(find.byWidget(_chip(tester, 'Beta'))).height,
      );
    });

    testWidgets('lets the hint run to as many lines as it needs', (
      tester,
    ) async {
      await _pump(tester, OptionStripSkin.settings);
      expect(_hint(tester).maxLines, isNull);
    });

    testWidgets('announces each segment as a selectable button', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      await _pump(tester, OptionStripSkin.settings);
      expect(find.bySemanticsLabel('Alpha, first'), findsOneWidget);
      expect(find.bySemanticsLabel('Beta'), findsOneWidget);
      handle.dispose();
    });
  });
}
