import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/widgets/composer_dock.dart';
import 'package:kallo_mobile/features/logging/widgets/composer_glow.dart';

Widget _wrap() => MediaQuery(
  data: const MediaQueryData(disableAnimations: true),
  child: Directionality(
    textDirection: TextDirection.ltr,
    child: Align(
      alignment: Alignment.bottomCenter,
      child: ComposerDock(
        onHeightChanged: (_) {},
        child: const SizedBox(height: 56),
      ),
    ),
  ),
);

void main() {
  testWidgets('the halo never paints above the dock', (tester) async {
    await tester.pumpWidget(_wrap());
    await tester.pump();

    final dock = tester.getRect(find.byType(ComposerDock));
    final glow = tester.getRect(find.byType(ComposerGlow));

    // The dock floats OVER the feed, so every pixel of halo above the dock's
    // own top edge lands on a meal card that is still fully opaque and tints it
    // tan. Reaching 140 up did exactly that: the bottom cards went warm and the
    // last one nearly disappeared. The scrim band inside the dock is the only
    // place the halo may fade in, because that is where the scrim is fading
    // cards out at the same time.
    expect(
      glow.top,
      greaterThanOrEqualTo(dock.top - 0.5),
      reason: 'the halo has escaped the dock and is painting over the feed',
    );
  });

  testWidgets('the halo covers the dock, edge to edge', (tester) async {
    await tester.pumpWidget(_wrap());
    await tester.pump();

    final dock = tester.getRect(find.byType(ComposerDock));
    final glow = tester.getRect(find.byType(ComposerGlow));

    // A halo narrower than the screen reads as a blob centred on the input
    // rather than as the surface beneath it being lit.
    expect(glow.left, lessThanOrEqualTo(dock.left));
    expect(glow.right, greaterThanOrEqualTo(dock.right));
    // And it reaches the bottom, so the home-indicator inset is lit too.
    expect(glow.bottom, greaterThanOrEqualTo(dock.bottom));
  });
}
