import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:nham_mobile/features/logging/widgets/composer_dock.dart';
import 'package:nham_mobile/theme/nham_colors.dart';

/// The dock is what lets the feed flow UNDER the composer. Its contract is
/// small but load-bearing: it must be a solid surface, and it must report its
/// own height — the feed reserves exactly that much scroll padding, so a wrong
/// (or never-fired) measurement permanently hides the last meal card.
void main() {
  Widget host({
    required ValueChanged<double> onHeightChanged,
    double contentHeight = 64,
  }) => MaterialApp(
        home: Scaffold(
          body: Stack(
            children: [
              const Positioned.fill(child: ColoredBox(color: Colors.teal)),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: ComposerDock(
                  onHeightChanged: onHeightChanged,
                  child: SizedBox(height: contentHeight),
                ),
              ),
            ],
          ),
        ),
      );

  testWidgets('reports its laid-out height, content plus its own padding',
      (tester) async {
    double? reported;
    await tester.pumpWidget(host(onHeightChanged: (h) => reported = h));
    await tester.pumpAndSettle();

    expect(reported, isNotNull);
    expect(reported, tester.getSize(find.byType(ComposerDock)).height);
    // The dock pads above and below the composer, so it is always taller.
    expect(reported, greaterThan(64));
  });

  testWidgets('re-reports when the composer grows', (tester) async {
    final heights = <double>[];
    await tester.pumpWidget(host(onHeightChanged: heights.add));
    await tester.pumpAndSettle();
    final initial = heights.last;

    await tester.pumpWidget(
      host(onHeightChanged: heights.add, contentHeight: 140),
    );
    await tester.pumpAndSettle();

    expect(heights.last, greaterThan(initial));
    expect(heights.last - initial, 140 - 64);
  });

  testWidgets('is a solid surface, so cards pass cleanly behind it',
      (tester) async {
    await tester.pumpWidget(host(onHeightChanged: (_) {}));
    await tester.pumpAndSettle();

    // Translucency here would show the feed ghosting through the dock.
    final dock = tester.widget<Container>(
      find
          .descendant(
            of: find.byType(ComposerDock),
            matching: find.byType(Container),
          )
          .first,
    );
    expect(dock.color, NhamColors.surface);
  });
}
