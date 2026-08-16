import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/composer_dock.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

/// The dock is what lets the feed flow UNDER the composer. Its contract is
/// small but load-bearing: it must be a solid surface, and it must report its
/// own height — the feed reserves exactly that much scroll padding, so a wrong
/// (or never-fired) measurement permanently hides the last meal card.
void main() {
  Widget host({
    required ValueChanged<double> onHeightChanged,
    Widget child = const SizedBox(height: 64),
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
                  child: child,
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

  testWidgets('re-reports when the composer grows on its own', (tester) async {
    // The real scenario: the composer gains a line under the user's thumb via
    // its OWN setState, which never re-runs the dock's build. Driving this from
    // the host instead would pass even with the size notifier removed.
    final key = GlobalKey<_GrowerState>();
    final heights = <double>[];

    await tester.pumpWidget(
      host(onHeightChanged: heights.add, child: _Grower(key: key)),
    );
    await tester.pumpAndSettle();
    final initial = heights.last;

    key.currentState!.grow();
    await tester.pumpAndSettle();

    expect(
      heights.last - initial,
      _Grower.grownHeight - _Grower.restingHeight,
      reason: 'stale padding here buries the last meal card under the dock',
    );
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
    expect(dock.color, KalloColors.surface);
  });
}

/// A child that grows via its own setState — how [MealInput] behaves when the
/// user types a second line, without its parent rebuilding.
class _Grower extends StatefulWidget {
  const _Grower({super.key});

  static const double restingHeight = 64;
  static const double grownHeight = 140;

  @override
  State<_Grower> createState() => _GrowerState();
}

class _GrowerState extends State<_Grower> {
  double _height = _Grower.restingHeight;

  void grow() => setState(() => _height = _Grower.grownHeight);

  @override
  Widget build(BuildContext context) => SizedBox(height: _height);
}
