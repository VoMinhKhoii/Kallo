import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:nham_mobile/features/logging/logic/logging_spacing.dart';
import 'package:nham_mobile/features/logging/widgets/meal_action_icon_button.dart';
import 'package:nham_mobile/theme/kallo_colors.dart';

/// The selected wash and the tap target are deliberately different sizes, and
/// the wash has to stay on the Material ink layer. Both have regressed once:
/// the wash used to fill the whole hit box, and the fix for that briefly used
/// an opaque Container, which paints over the InkResponse splash.
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

  testWidgets('selected wash hugs the glyph, smaller than the hit box',
      (tester) async {
    await tester.pumpWidget(host(active: true));

    final ink = tester.widget<Ink>(find.byType(Ink));
    expect(ink.width, LoggingIcons.wash);
    expect(ink.height, LoggingIcons.wash);
    expect(
      LoggingIcons.wash,
      lessThan(LoggingIcons.hit),
      reason: 'a selected action must not fill its whole tap target',
    );
    expect(
      (ink.decoration! as BoxDecoration).color,
      KalloColors.hover,
    );
  });

  testWidgets('idle draws no wash', (tester) async {
    await tester.pumpWidget(host(active: false));
    final ink = tester.widget<Ink>(find.byType(Ink));
    expect((ink.decoration! as BoxDecoration).color, Colors.transparent);
  });
}
