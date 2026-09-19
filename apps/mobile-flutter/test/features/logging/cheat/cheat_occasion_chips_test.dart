import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/data/logging_providers.dart';
import 'package:kallo_mobile/features/logging/widgets/cheat/cheat_occasion_chips.dart';
import 'package:kallo_mobile/models/logging/cheat.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

import '../../../app_fonts.dart';

const _userId = 'u1';

const _occasions = [
  RecentCheatOccasion(
    mealId: 'm1',
    rawInput: 'Korean BBQ buffet',
    loggedAt: '2026-09-01',
  ),
  RecentCheatOccasion(mealId: 'm2', rawInput: 'Pho', loggedAt: '2026-09-02'),
];

Future<void> _pump(WidgetTester tester, {bool disabled = false}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        recentCheatOccasionsProvider(
          _userId,
        ).overrideWith((ref) async => _occasions),
      ],
      child: MaterialApp(
        home: Scaffold(
          body: CheatOccasionChips(
            userId: _userId,
            disabled: disabled,
            onSelect: (_) {},
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('every chip clears the 44pt tap floor', (tester) async {
    // The painted pill is ~30pt — correct for its tier. The TARGET is what
    // has to reach 44 (`KalloIcons.hit`), which every other interactive
    // surface in the app already honours. Guarding the gesture box rather
    // than the pill is the point: the pill must NOT grow.
    await _pump(tester);

    for (final label in ['Korean BBQ buffet', 'Pho']) {
      final box = find.ancestor(
        of: find.text(label),
        matching: find.byType(GestureDetector),
      );
      expect(box, findsWidgets, reason: 'chip "$label" has a gesture box');
      expect(
        tester.getSize(box.first).height,
        greaterThanOrEqualTo(KalloIcons.hit),
        reason: 'chip "$label" is below the 44pt tap floor',
      );
    }
  });

  testWidgets('the painted pill stays its own size', (tester) async {
    // The other half of the contract: expanding the target must not have
    // fattened the chip. If this starts failing, the ConstrainedBox has been
    // moved onto the pill instead of around it.
    await _pump(tester);

    final pill = find.ancestor(
      of: find.text('Pho'),
      matching: find.byType(AnimatedContainer),
    );
    expect(tester.getSize(pill.first).height, lessThan(KalloIcons.hit));
  });
}
