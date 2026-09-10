import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/theme/kallo_theme.dart';

/// The app-wide back drag (`shell/nav/swipe_back/`).
///
/// The whole point is that it starts ANYWHERE on the page: Flutter's stock
/// gesture only arms inside a 20pt edge strip, so every drag here begins at
/// mid-screen, which is the case that fails without the vendored builder.
///
/// These run under the default test platform (android), which is exactly why
/// the builder is registered for android as well as the Apple platforms — an
/// iOS-only registration would make the gesture untestable.
void main() {
  const first = Key('first-page');
  const second = Key('second-page');

  Widget app({Widget? secondBody}) => MaterialApp(
    theme: KalloTheme.light(),
    home: Builder(
      builder: (context) => Scaffold(
        key: first,
        body: Center(
          child: TextButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => Scaffold(
                  key: second,
                  body: secondBody ?? const Center(child: Text('second')),
                ),
              ),
            ),
            child: const Text('push'),
          ),
        ),
      ),
    ),
  );

  Future<void> pushSecond(WidgetTester tester) async {
    await tester.tap(find.text('push'));
    await tester.pumpAndSettle();
    expect(find.byKey(second), findsOneWidget);
  }

  /// A drag that starts at the middle of the screen, not on the edge.
  Future<void> dragFromMiddle(
    WidgetTester tester,
    double dx, {
    Duration? duration,
  }) async {
    final centre = tester.getCenter(find.byKey(second));
    await tester.timedDragFrom(
      centre,
      Offset(dx, 0),
      duration ?? const Duration(milliseconds: 400),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('a rightward drag from mid-screen pops a pushed route', (
    tester,
  ) async {
    await tester.pumpWidget(app());
    await pushSecond(tester);

    await dragFromMiddle(tester, 400);

    expect(find.byKey(second), findsNothing);
    expect(find.byKey(first), findsOneWidget);
  });

  testWidgets('a leftward drag never starts a back gesture', (tester) async {
    await tester.pumpWidget(app());
    await pushSecond(tester);

    await dragFromMiddle(tester, -400);

    expect(find.byKey(second), findsOneWidget);
  });

  testWidgets('the first route has nothing to pop, so the drag does nothing', (
    tester,
  ) async {
    await tester.pumpWidget(app());

    final centre = tester.getCenter(find.byKey(first));
    await tester.timedDragFrom(
      centre,
      const Offset(400, 0),
      const Duration(milliseconds: 400),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(first), findsOneWidget);
  });

  testWidgets('released short of half-way and slowly, the page comes back', (
    tester,
  ) async {
    await tester.pumpWidget(app());
    await pushSecond(tester);

    // Well under half the width, and slow enough not to read as a fling.
    await dragFromMiddle(
      tester,
      40,
      duration: const Duration(milliseconds: 1200),
    );

    expect(find.byKey(second), findsOneWidget);
  });

  testWidgets('a short flick past the fling velocity still pops', (
    tester,
  ) async {
    await tester.pumpWidget(app());
    await pushSecond(tester);

    await dragFromMiddle(
      tester,
      120,
      duration: const Duration(milliseconds: 60),
    );

    expect(find.byKey(second), findsNothing);
  });

  testWidgets('a horizontal scrollable under the finger wins the drag', (
    tester,
  ) async {
    final controller = ScrollController();
    addTearDown(controller.dispose);

    await tester.pumpWidget(
      app(
        secondBody: ListView(
          controller: controller,
          scrollDirection: Axis.horizontal,
          children: <Widget>[
            for (int i = 0; i < 12; i++) SizedBox(width: 200, child: Text('$i')),
          ],
        ),
      ),
    );
    await pushSecond(tester);

    // Start scrolled in, so there is somewhere for a rightward drag to go.
    controller.jumpTo(600);
    await tester.pump();

    await dragFromMiddle(tester, 400);

    // The list scrolled; the route did not pop.
    expect(find.byKey(second), findsOneWidget);
    expect(controller.offset, lessThan(600));
  });

  testWidgets('the theme keeps Cupertino’s 500ms push, not Material’s 300ms', (
    tester,
  ) async {
    late BuildContext ctx;
    await tester.pumpWidget(
      MaterialApp(
        theme: KalloTheme.light(),
        home: Builder(
          builder: (context) {
            ctx = context;
            return const SizedBox.shrink();
          },
        ),
      ),
    );

    final route = MaterialPageRoute<void>(
      builder: (_) => const SizedBox.shrink(),
    );
    // The duration is resolved off the theme's builder, so it needs the route
    // to have a context to read it from.
    final theme = Theme.of(ctx).pageTransitionsTheme;
    expect(
      theme.builders[TargetPlatform.android]?.transitionDuration,
      const Duration(milliseconds: 500),
    );
    expect(
      theme.builders[TargetPlatform.iOS]?.transitionDuration,
      const Duration(milliseconds: 500),
    );
    route.dispose();
  });
}
