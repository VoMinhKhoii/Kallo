import 'dart:ui' show Tristate;

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/form/option_row.dart';
import 'package:kallo_mobile/theme/calm_tokens.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

/// The onboarding pick row. Two things about it are load-bearing and neither
/// is visible in a static screenshot: the selection is carried by the BORDER
/// (so it must not move the label when it thickens), and the row has to reach
/// assistive technology as a radio, not as an anonymous button.

const double _hostWidth = 358;

Widget _wrap(Widget child) => MaterialApp(
      home: Scaffold(
        body: Center(child: SizedBox(width: _hostWidth, child: child)),
      ),
    );

/// The row's own animated box — the first [AnimatedContainer] under the widget
/// (the radio is the second, nested inside it).
BoxDecoration _box(WidgetTester tester, {required bool radio}) {
  final finder = find
      .descendant(
        of: find.byType(OptionRow),
        matching: find.byType(AnimatedContainer),
      );
  final container =
      tester.widget<AnimatedContainer>(radio ? finder.last : finder.first);
  return container.decoration! as BoxDecoration;
}

BorderSide _side(BoxDecoration box) => (box.border! as Border).top;

class _Host extends StatefulWidget {
  const _Host();

  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> {
  bool _selected = false;

  @override
  Widget build(BuildContext context) => OptionRow(
        label: 'English',
        selected: _selected,
        onTap: () => setState(() => _selected = true),
      );
}

void main() {
  testWidgets('selected wears a 2px ink border, the card shadow and a filled '
      'radio', (tester) async {
    await tester.pumpWidget(
      _wrap(OptionRow(label: 'English', selected: true, onTap: () {})),
    );

    final row = _box(tester, radio: false);
    expect(_side(row).width, OptionRow.selectedBorder);
    expect(_side(row).color, kInk);
    expect(row.boxShadow, kCardShadows);

    final radio = _box(tester, radio: true);
    expect(radio.shape, BoxShape.circle);
    expect(_side(radio).width, OptionRow.selectedRing);
    expect(_side(radio).color, kInk);
  });

  testWidgets('idle is a flat hairline row with a hollow radio', (tester) async {
    await tester.pumpWidget(
      _wrap(OptionRow(label: 'English', selected: false, onTap: () {})),
    );

    final row = _box(tester, radio: false);
    expect(_side(row).width, OptionRow.idleBorder);
    expect(_side(row).color, KalloColors.border);
    // No shadow: an unselected row separates from the canvas by surface alone.
    expect(row.boxShadow, isNull);

    final radio = _box(tester, radio: true);
    expect(_side(radio).width, OptionRow.idleRing);
    expect(_side(radio).color, KalloColors.border);
  });

  testWidgets('the thicker border is paid for out of the padding, so picking '
      'a row does not nudge its own label', (tester) async {
    await tester.pumpWidget(_wrap(const _Host()));
    final double before = tester.getTopLeft(find.text('English')).dx;

    await tester.tap(find.byType(OptionRow));
    await tester.pumpAndSettle();

    expect(_side(_box(tester, radio: false)).width, OptionRow.selectedBorder);
    expect(tester.getTopLeft(find.text('English')).dx, closeTo(before, 0.01));
  });

  testWidgets('the whole row is the tap target, selected or not', (tester) async {
    var taps = 0;
    await tester.pumpWidget(
      _wrap(
        OptionRow(
          label: 'English',
          subline: 'From your phone',
          note: '30 / 35 / 35',
          selected: true,
          onTap: () => taps++,
        ),
      ),
    );

    // Tap the trailing note, as far from the label as the row goes.
    await tester.tap(find.text('30 / 35 / 35'));
    await tester.pump();
    expect(taps, 1);
  });

  testWidgets('a disabled row takes no taps', (tester) async {
    var taps = 0;
    await tester.pumpWidget(
      _wrap(
        OptionRow(
          label: 'English',
          selected: false,
          enabled: false,
          onTap: () => taps++,
        ),
      ),
    );

    await tester.tap(find.byType(OptionRow), warnIfMissed: false);
    await tester.pump();
    expect(taps, 0);
  });

  testWidgets('it reaches assistive technology as a selected radio',
      (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(
      _wrap(
        OptionRow(
          label: 'English',
          subline: 'From your phone',
          selected: true,
          onTap: () {},
        ),
      ),
    );

    final data =
        tester.getSemantics(find.byType(OptionRow)).getSemanticsData();
    expect(data.flagsCollection.isInMutuallyExclusiveGroup, isTrue,
        reason: 'a one-of-many pick must announce as a radio');
    // Tristate, not bool: "selected" also carries whether the row HAS a
    // selected state at all, which is what makes it a radio and not a label.
    expect(data.flagsCollection.isSelected, Tristate.isTrue);
    expect(data.hasAction(SemanticsAction.tap), isTrue);
    // The subline is part of the name — "English" alone does not say the row
    // was filled in from the phone.
    expect(data.label, 'English, From your phone');
    handle.dispose();
  });

  testWidgets('the trailing note is part of the name too', (tester) async {
    // The ratio on a carb-split row is the whole difference between the three
    // choices; a screen reader that never reads it announces three identical
    // rows. PlanRow already folds its chip in the same way.
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(
      _wrap(
        OptionRow(
          label: 'Moderate carb',
          note: '30 / 35 / 35',
          selected: false,
          onTap: () {},
        ),
      ),
    );

    expect(
      tester.getSemantics(find.byType(OptionRow)).getSemanticsData().label,
      'Moderate carb, 30 / 35 / 35',
    );
    handle.dispose();
  });

  testWidgets('height is 64 by default and honours the tighter variants',
      (tester) async {
    for (final double height in [64.0, 56.0, 48.0]) {
      await tester.pumpWidget(
        _wrap(
          OptionRow(
            key: ValueKey(height),
            label: 'English',
            selected: false,
            height: height,
            onTap: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.getSize(find.byType(OptionRow)).height, height);
    }
  });
}
