import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:kallo_mobile/features/logging/logic/logging_spacing.dart';
import 'package:kallo_mobile/features/logging/widgets/actions/meal_action_icon_button.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

/// The selected wash and the tap target are deliberately different sizes, and
/// the wash has to stay on the Material ink layer. Both have regressed once:
/// the wash used to fill the whole hit box, and the fix for that briefly used
/// an opaque Container, which paints over the InkResponse splash. Both washes
/// are one circle: the press used to light a rounded square the size of the
/// whole hit box, which the selected chip never matched.
void main() {
  Widget host({required bool active}) => MaterialApp(
    home: Scaffold(
      body: Center(
        child: MealActionIconButton(
          icon: LucideIcons.userPlus300,
          label: 'Share',
          active: active,
          onTap: () {},
        ),
      ),
    ),
  );

  testWidgets('tap target stays LoggingIcons.hit', (tester) async {
    await tester.pumpWidget(host(active: false));
    expect(
      tester.getSize(find.byType(MealActionIconButton)),
      const Size(LoggingIcons.hit, LoggingIcons.hit),
    );
  });

  testWidgets('selected wash hugs the glyph, smaller than the hit box', (
    tester,
  ) async {
    await tester.pumpWidget(host(active: true));

    final ink = tester.widget<Ink>(find.byType(Ink));
    expect(ink.width, LoggingIcons.wash);
    expect(ink.height, LoggingIcons.wash);
    expect(
      LoggingIcons.wash,
      lessThan(LoggingIcons.hit),
      reason: 'a selected action must not fill its whole tap target',
    );
    final decoration = ink.decoration! as BoxDecoration;
    expect(decoration.color, KalloColors.hover);
    expect(decoration.shape, BoxShape.circle);
  });

  testWidgets('idle draws no wash', (tester) async {
    await tester.pumpWidget(host(active: false));
    final ink = tester.widget<Ink>(find.byType(Ink));
    expect((ink.decoration! as BoxDecoration).color, Colors.transparent);
  });

  testWidgets('a press lights the same circle, not the square hit box', (
    tester,
  ) async {
    await tester.pumpWidget(host(active: false));
    final gesture = await tester.startGesture(
      tester.getCenter(find.byType(MealActionIconButton)),
    );
    // Past the tap-down delay and the highlight's fade-in, finger still down.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    final element = tester.element(find.byType(InkResponse));
    final pressed = Theme.of(element).highlightColor;
    final ink = Material.of(element);
    // The idle wash paints first (transparent), the press over it: the same
    // circle around the glyph both times, and nothing square anywhere.
    expect(
      ink,
      paints
        ..circle(radius: LoggingIcons.wash / 2)
        ..circle(color: pressed, radius: LoggingIcons.wash / 2),
    );
    expect(ink, isNot(paints..rrect()));

    await gesture.up();
    await tester.pumpAndSettle();
  });
}
