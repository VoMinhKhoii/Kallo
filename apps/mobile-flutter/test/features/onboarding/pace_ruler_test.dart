import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/widgets/pace_ruler.dart';

/// The pace ruler is a tape measure, not a slider: the scale travels under a
/// fixed needle. One pitch of travel is one step, the strip lands ON a detent,
/// and the ends stop.

const double _hostWidth = 320;
const String _readout = 'half a kilo a week';

class _Host extends StatefulWidget {
  const _Host({this.initial = 0.3, this.locale = const Locale('en')});

  final double initial;
  final Locale locale;

  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> {
  late double value = widget.initial;

  @override
  Widget build(BuildContext context) => MaterialApp(
        locale: widget.locale,
        supportedLocales: [widget.locale],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: _hostWidth,
              child: PaceRuler(
                value: value,
                onChanged: (v) => setState(() => value = v),
                label: 'Pace',
                readout: _readout,
                lowLabel: 'Gentle',
                highLabel: 'Aggressive',
              ),
            ),
          ),
        ),
      );
}

double _value(WidgetTester tester) =>
    tester.state<_HostState>(find.byType(_Host)).value;

Future<void> _pump(
  WidgetTester tester, {
  double initial = 0.3,
  Locale locale = const Locale('en'),
}) async {
  await tester.pumpWidget(_Host(initial: initial, locale: locale));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('one pitch of drag is one step', (tester) async {
    await _pump(tester);
    expect(_value(tester), closeTo(0.3, 1e-9));

    await tester.drag(
      find.byType(PaceRuler),
      const Offset(-PaceRuler.pitchPerTenth, 0),
    );
    await tester.pumpAndSettle();

    expect(_value(tester), closeTo(0.4, 1e-9));
  });

  testWidgets('a half-step drag still settles onto a detent', (tester) async {
    await _pump(tester);

    // Two thirds of a pitch: past the midpoint, so the strip has to finish
    // the journey onto the NEXT detent on its own.
    await tester.drag(
      find.byType(PaceRuler),
      const Offset(-PaceRuler.pitchPerTenth * 2 / 3, 0),
    );
    await tester.pumpAndSettle();

    expect(_value(tester), closeTo(0.4, 1e-9));
    // The chosen step's graduation sits under the needle.
    expect(
      tester.getCenter(find.text('0.4')).dx,
      closeTo(tester.getCenter(find.byType(PaceRuler)).dx, 0.5),
    );
  });

  testWidgets('the ends stop', (tester) async {
    await _pump(tester);

    await tester.drag(find.byType(PaceRuler), const Offset(-2000, 0));
    await tester.pumpAndSettle();
    expect(_value(tester), closeTo(0.8, 1e-9));

    await tester.drag(find.byType(PaceRuler), const Offset(2000, 0));
    await tester.pumpAndSettle();
    expect(_value(tester), closeTo(0.1, 1e-9));
  });

  testWidgets('the readout line, the end labels and every step are on screen',
      (tester) async {
    await _pump(tester);

    expect(find.text('Pace'), findsOneWidget);
    expect(find.text(_readout), findsOneWidget);
    expect(find.text('Gentle'), findsOneWidget);
    expect(find.text('Aggressive'), findsOneWidget);
    for (final step in ['0.1', '0.4', '0.8']) {
      expect(find.text(step), findsOneWidget, reason: '$step lost its label');
    }
  });

  testWidgets('the graduations follow the locale\'s decimal mark', (tester) async {
    // `toStringAsFixed(1)` hardcodes the POINT; Vietnamese writes 0,5.
    await _pump(tester, locale: const Locale('vi'));

    expect(find.text('0,5'), findsOneWidget);
    expect(find.text('0.5'), findsNothing);
  });

  testWidgets('assistive technology can raise and lower the pace',
      (tester) async {
    final handle = tester.ensureSemantics();
    await _pump(tester);

    // Through the FLAG, not the widget type: the slider node is the one
    // carrying the value and the actions.
    final slider = find.semantics.byFlag(SemanticsFlag.isSlider);
    final data = slider.evaluate().single.getSemanticsData();
    expect(data.hasAction(SemanticsAction.increase), isTrue);
    expect(data.hasAction(SemanticsAction.decrease), isTrue);
    // The value reads as the sentence, not as a raw fraction.
    expect(data.value, _readout);
    expect(data.label, 'Pace');

    tester.semantics.increase(slider);
    await tester.pumpAndSettle();
    expect(_value(tester), closeTo(0.4, 1e-9));

    tester.semantics.decrease(slider);
    tester.semantics.decrease(slider);
    await tester.pumpAndSettle();
    expect(_value(tester), closeTo(0.2, 1e-9));

    handle.dispose();
  });
}
