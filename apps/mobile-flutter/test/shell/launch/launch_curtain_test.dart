import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shell/launch/launch_curtain.dart';
import 'package:kallo_mobile/shell/launch/launch_painter.dart';
import 'package:kallo_mobile/shell/launch/launch_timeline.dart';
import 'package:kallo_mobile/shell/launch/portal_reveal.dart';

/// The app under the curtain: counts its taps and its mounts.
class _App extends StatefulWidget {
  const _App({required this.onTap});

  final VoidCallback onTap;

  static int mounts = 0;

  @override
  State<_App> createState() => _AppState();
}

class _AppState extends State<_App> {
  @override
  void initState() {
    super.initState();
    _App.mounts++;
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: widget.onTap,
    child: Semantics(
      label: 'dashboard',
      child: const ColoredBox(color: Color(0xFFFFFFFF)),
    ),
  );
}

Widget _host(
  ValueNotifier<bool> ready,
  VoidCallback onTap, {
  bool reduce = false,
}) => MediaQuery(
  data: MediaQueryData(size: const Size(393, 852), disableAnimations: reduce),
  child: Directionality(
    textDirection: TextDirection.ltr,
    child: LaunchCurtain(ready: ready, child: _App(onTap: onTap)),
  ),
);

final _curtain = find.byWidgetPredicate(
  (w) => w is CustomPaint && w.painter is LaunchPainter,
);

Duration _ms(double ms) => Duration(microseconds: (ms * 1000).round());

void main() {
  setUp(() => _App.mounts = 0);

  testWidgets('covers the app from the first frame and swallows its taps', (
    tester,
  ) async {
    var taps = 0;
    await tester.pumpWidget(_host(ValueNotifier(true), () => taps++));

    expect(_curtain, findsOneWidget);
    await tester.tapAt(const Offset(196, 426));
    expect(taps, 0);
  });

  testWidgets('plays the whole intro even when the app is ready at once', (
    tester,
  ) async {
    const timeline = LaunchTimeline();
    await tester.pumpWidget(_host(ValueNotifier(true), () {}));

    await tester.pump(_ms(timeline.introEnd + PortalReveal.duration - 20));
    expect(_curtain, findsOneWidget);
    await tester.pump(_ms(40));
    expect(_curtain, findsNothing);
  });

  testWidgets('waits for the app however long it takes, then lifts', (
    tester,
  ) async {
    var taps = 0;
    final ready = ValueNotifier(false);
    await tester.pumpWidget(_host(ready, () => taps++));

    await tester.pump(const Duration(seconds: 12));
    expect(_curtain, findsOneWidget);

    ready.value = true;
    await tester.pump();
    await tester.pump(_ms(PortalReveal.duration + 20));
    expect(_curtain, findsNothing);

    await tester.tapAt(const Offset(196, 426));
    expect(taps, 1);
  });

  testWidgets('lifting it never remounts the app underneath', (tester) async {
    await tester.pumpWidget(_host(ValueNotifier(true), () {}));
    final before = tester.state(find.byType(_App));

    await tester.pump(const Duration(seconds: 3));
    expect(_curtain, findsNothing);
    expect(tester.state(find.byType(_App)), same(before));
    expect(_App.mounts, 1);
  });

  testWidgets('hides the app from assistive technology until it lifts', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await tester.pumpWidget(_host(ValueNotifier(true), () {}));

    expect(find.bySemanticsLabel('Kallo'), findsOneWidget);
    expect(find.bySemanticsLabel('dashboard'), findsNothing);

    await tester.pump(const Duration(seconds: 3));
    expect(find.bySemanticsLabel('dashboard'), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('with Reduce Motion it still waits for the app, then fades', (
    tester,
  ) async {
    const reduced = LaunchTimeline(reduceMotion: true);
    final ready = ValueNotifier(false);
    await tester.pumpWidget(_host(ready, () {}, reduce: true));

    await tester.pump(const Duration(seconds: 5));
    expect(_curtain, findsOneWidget);

    ready.value = true;
    await tester.pump();
    await tester.pump(_ms(reduced.revealDuration + 20));
    expect(_curtain, findsNothing);
  });
}
