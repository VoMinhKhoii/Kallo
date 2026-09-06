import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:kallo_mobile/features/onboarding/widgets/onboarding_step_header.dart';
import 'package:kallo_mobile/shared/widgets/brand/kallo_wordmark.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

/// The header is the only thing that persists across all six steps, so the
/// wordmark must not move and the bar must actually say where you are.

Widget _wrap(Widget child) => MaterialApp(
      home: Scaffold(
        body: Center(child: SizedBox(width: 358, child: child)),
      ),
    );

OnboardingStepHeader _header({
  int step = 3,
  VoidCallback? onBack,
  VoidCallback? onSkip,
  String? skipLabel,
}) =>
    OnboardingStepHeader(
      step: step,
      total: 6,
      progressLabel: 'Step $step of 6',
      onBack: onBack,
      onSkip: onSkip,
      skipLabel: skipLabel,
    );

double _fill(WidgetTester tester) =>
    tester.widget<FractionallySizedBox>(find.byType(FractionallySizedBox))
        .widthFactor!;

void main() {
  testWidgets('the wordmark is centred whatever else the row carries',
      (tester) async {
    await tester.pumpWidget(_wrap(_header()));
    await tester.pumpAndSettle();

    expect(find.byType(KalloWordmark), findsOneWidget);
    expect(
      tester.widget<KalloWordmark>(find.byType(KalloWordmark)).height,
      OnboardingStepHeader.wordmarkHeight,
    );
    final double bare = tester.getCenter(find.byType(KalloWordmark)).dx;

    await tester.pumpWidget(
      _wrap(_header(onBack: () {}, onSkip: () {}, skipLabel: 'Skip')),
    );
    await tester.pumpAndSettle();

    // A three-slot Row would have shifted it; the Stack does not.
    expect(tester.getCenter(find.byType(KalloWordmark)).dx, closeTo(bare, 0.01));
  });

  testWidgets('back and skip appear only when they are wired, on 44pt targets',
      (tester) async {
    await tester.pumpWidget(_wrap(_header()));
    await tester.pumpAndSettle();
    expect(find.byIcon(LucideIcons.chevronLeft300), findsNothing);
    expect(find.text('Skip'), findsNothing);

    var backs = 0, skips = 0;
    await tester.pumpWidget(
      _wrap(
        _header(
          onBack: () => backs++,
          onSkip: () => skips++,
          skipLabel: 'Skip',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      tester.getSize(find.byIcon(LucideIcons.chevronLeft300)).height,
      KalloIcons.hit,
    );
    // The Icon's own box is not hit-testable — the 44pt GestureDetector
    // around it is what takes the tap, so the miss warning is noise here.
    await tester.tap(
      find.byIcon(LucideIcons.chevronLeft300),
      warnIfMissed: false,
    );
    await tester.pump();
    await tester.tap(find.text('Skip'));
    await tester.pump();
    expect(backs, 1);
    expect(skips, 1);
  });

  testWidgets('the bar fills step / total and animates between steps',
      (tester) async {
    await tester.pumpWidget(_wrap(_header(step: 3)));
    await tester.pumpAndSettle();
    expect(_fill(tester), closeTo(0.5, 1e-9));
    // …and the fraction reaches the screen: a fill laid out 0 tall is a bar
    // that reads as empty on every step.
    expect(
      tester.getSize(find.byType(FractionallySizedBox)),
      const Size(179, OnboardingStepHeader.barHeight),
    );

    await tester.pumpWidget(_wrap(_header(step: 6)));
    await tester.pump(const Duration(milliseconds: 50));
    // Mid-flight: it travels rather than snapping.
    expect(_fill(tester), greaterThan(0.5));
    expect(_fill(tester), lessThan(1.0));

    await tester.pumpAndSettle();
    expect(_fill(tester), closeTo(1.0, 1e-9));
  });

  testWidgets('the bar announces which step this is', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(_wrap(_header(step: 2)));
    await tester.pumpAndSettle();

    expect(find.bySemanticsLabel('Step 2 of 6'), findsOneWidget);
    handle.dispose();
  });
}
