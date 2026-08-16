import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/settings/widgets/settings_navigator.dart';
import 'package:kallo_mobile/shared/widgets/scroll_separator.dart';

/// An iOS edge-swipe: a long, fast drag from the left gutter.
Future<void> edgeSwipe(WidgetTester tester) async {
  final gesture = await tester.startGesture(const Offset(2, 300));
  for (var i = 0; i < 18; i++) {
    await gesture.moveBy(const Offset(40, 0));
    await tester.pump(const Duration(milliseconds: 16));
  }
  await gesture.up();
  await tester.pumpAndSettle();
}

/// The shell: `/settings` is pushed as a Cupertino route, exactly as the router
/// does, so the nested navigator is nested inside a swipeable route.
Widget shell(Widget settings) => MaterialApp(
      home: Builder(
        builder: (context) => Center(
          child: TextButton(
            onPressed: () => Navigator.of(context).push(
              CupertinoPageRoute<void>(builder: (_) => settings),
            ),
            child: const Text('shell'),
          ),
        ),
      ),
    );

class _Root extends StatelessWidget {
  const _Root();

  @override
  Widget build(BuildContext context) => Material(
        child: Center(
          child: TextButton(
            onPressed: () => Navigator.of(context).push(
              CupertinoPageRoute<void>(
                builder: (_) => const Material(child: Center(child: Text('editor'))),
              ),
            ),
            child: const Text('settings-root'),
          ),
        ),
      );
}

void main() {
  group('SettingsNavigator', () {
    testWidgets('a swipe on a drill-in pops ONE level, not the whole tab', (
      tester,
    ) async {
      await tester.pumpWidget(shell(const SettingsNavigator(root: _Root())));
      await tester.tap(find.text('shell'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('settings-root'));
      await tester.pumpAndSettle();
      expect(find.text('editor'), findsOneWidget);

      await edgeSwipe(tester);

      // Without the pop arbitration the OUTER route wins the gesture arena and
      // this swipe drags the whole settings tab away instead.
      expect(find.text('editor'), findsNothing);
      expect(find.text('settings-root'), findsOneWidget);
    });

    testWidgets('at the nested root the swipe closes settings', (tester) async {
      await tester.pumpWidget(shell(const SettingsNavigator(root: _Root())));
      await tester.tap(find.text('shell'));
      await tester.pumpAndSettle();

      await edgeSwipe(tester);

      expect(find.text('settings-root'), findsNothing);
      expect(find.text('shell'), findsOneWidget);
    });

    testWidgets('system back pops the nested stack before the tab', (
      tester,
    ) async {
      await tester.pumpWidget(shell(const SettingsNavigator(root: _Root())));
      await tester.tap(find.text('shell'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('settings-root'));
      await tester.pumpAndSettle();

      final ok = await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();

      expect(ok, isTrue);
      expect(find.text('editor'), findsNothing);
      expect(find.text('settings-root'), findsOneWidget);
    });
  });

  group('ScrollSeparator', () {
    double opacity(WidgetTester tester) =>
        tester.widget<AnimatedOpacity>(find.byType(AnimatedOpacity)).opacity;

    Future<void> pumpWith(WidgetTester tester, Widget body, Key key) =>
        tester.pumpWidget(
          MaterialApp(
            key: key,
            home: ScrollSeparator(
              header: const SizedBox(height: 40),
              child: body,
            ),
          ),
        );

    testWidgets('hidden at rest, fades in on scroll, out again at the top', (
      tester,
    ) async {
      await pumpWith(
        tester,
        ListView(children: List.generate(50, (_) => const SizedBox(height: 40))),
        const ValueKey('list'),
      );
      expect(opacity(tester), 0);

      await tester.drag(find.byType(ListView), const Offset(0, -200));
      await tester.pump();
      expect(opacity(tester), 1);

      await tester.drag(find.byType(ListView), const Offset(0, 400));
      await tester.pump();
      expect(opacity(tester), 0);
    });

    testWidgets('works for SingleChildScrollView and CustomScrollView', (
      tester,
    ) async {
      final bodies = <Key, Widget>{
        const ValueKey('single'): SingleChildScrollView(
          child: Column(
            children: List.generate(50, (_) => const SizedBox(height: 40)),
          ),
        ),
        const ValueKey('custom'): CustomScrollView(
          slivers: [
            SliverList.list(
              children: List.generate(50, (_) => const SizedBox(height: 40)),
            ),
          ],
        ),
      };
      for (final entry in bodies.entries) {
        await pumpWith(tester, entry.value, entry.key);
        expect(opacity(tester), 0, reason: '${entry.key} at rest');
        await tester.drag(find.byType(Scrollable), const Offset(0, -200));
        await tester.pump();
        expect(opacity(tester), 1, reason: '${entry.key} scrolled');
      }
    });
  });
}
