import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/mascot/bun_mascot.dart';
import 'package:kallo_mobile/shared/widgets/mascot/mascot_timing.dart';

/// The bun on a bare surface — no l10n, no router: the mascot takes its line
/// as a plain string, so the host only has to supply a MediaQuery.
Widget _host(Widget child, {bool disableAnimations = false}) => MaterialApp(
  home: Scaffold(
    body: Builder(
      builder:
          (context) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(disableAnimations: disableAnimations),
            child: Padding(padding: const EdgeInsets.all(24), child: child),
          ),
    ),
  ),
);

/// The bubble renders one `Text.rich`; its plain text is what has been typed.
String _typed(WidgetTester tester) =>
    tester.widget<Text>(find.byType(Text)).textSpan!.toPlainText();

double _frameOpacity(WidgetTester tester, String name) =>
    tester.widget<Opacity>(find.byKey(ValueKey('bunFrame.$name'))).opacity;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('frames', () {
    test('the three mascot frames are bundled and are WebP', () async {
      for (final frame in const [
        kBunBaseFrame,
        kBunBlinkFrame,
        kBunWideFrame,
      ]) {
        final bytes = await rootBundle.load(frame);
        expect(bytes.lengthInBytes, greaterThan(1000), reason: frame);
        final header = bytes.buffer.asUint8List(0, 12);
        expect(
          String.fromCharCodes(header.sublist(0, 4)),
          'RIFF',
          reason: frame,
        );
        expect(
          String.fromCharCodes(header.sublist(8, 12)),
          'WEBP',
          reason: frame,
        );
      }
    });
  });

  group('BunMascot', () {
    setUp(() => BunMascot.debugRandom = math.Random(7));
    tearDown(() => BunMascot.debugRandom = null);

    testWidgets('blinks on top of an always-opaque base frame', (tester) async {
      await tester.pumpWidget(
        _host(const BunMascot(speech: 'Xin chào! Hello there, friend.')),
      );

      var sawLid = false;
      // The settling blink lands ~300ms in, deferred by the mouth guard; the
      // whole lid cycle is done inside a second.
      for (var i = 0; i < 64; i++) {
        await tester.pump(const Duration(milliseconds: 16));
        expect(_frameOpacity(tester, 'base'), 1);
        final lid = _frameOpacity(tester, 'blink');
        expect(lid, inInclusiveRange(0, 1));
        if (lid > 0) sawLid = true;
      }
      expect(sawLid, isTrue, reason: 'no blink within the first second');
    });

    testWidgets('types the whole line, one character at a time', (tester) async {
      const speech = 'Where do you cook most days?';
      await tester.pumpWidget(_host(const BunMascot(speech: speech)));
      await tester.pump();
      expect(_typed(tester).length, lessThan(speech.length));

      // 30ms a character plus a punctuation rest, with room to spare.
      for (var i = 0; i < 120; i++) {
        await tester.pump(const Duration(milliseconds: 16));
      }
      expect(_typed(tester), speech);
    });

    testWidgets('a punctuation mark rests the type loop', (tester) async {
      // Two lines of the same length; the first spends a comma's worth of
      // extra time, so it MUST be behind the second at the same instant.
      const paused = 'aaaa,aaaaaaaaaaaaaaaaaaaa';
      const plain = 'aaaaaaaaaaaaaaaaaaaaaaaaa';
      final typed = <int>[];
      for (final line in const [paused, plain]) {
        await tester.pumpWidget(_host(BunMascot(key: UniqueKey(), speech: line)));
        await tester.pump(const Duration(milliseconds: 300));
        typed.add(_typed(tester).length);
      }
      expect(typed.first, lessThan(typed.last));
    });

    testWidgets('shows the whole line at once with animations off', (
      tester,
    ) async {
      const speech = 'Here is your day. Pick a split and it updates.';
      await tester.pumpWidget(
        _host(const BunMascot(speech: speech), disableAnimations: true),
      );
      expect(_typed(tester), speech);

      await tester.pump();
      expect(_typed(tester), speech);
      // No breathing: the bun sits at rest.
      await tester.pump(const Duration(milliseconds: 1000));
      final scale = tester.widget<Transform>(
        find.ancestor(
          of: find.byKey(const ValueKey('bunFrame.base')),
          matching: find.byType(Transform),
        ),
      );
      expect(scale.transform.getMaxScaleOnAxis(), closeTo(1, 0.0001));
    });
  });
}
