import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/form/option_strip.dart';
import 'package:kallo_mobile/shared/widgets/form/segmented_strip.dart';
import 'package:kallo_mobile/theme/kallo_motion.dart';

/// The thumb's motion, sampled frame by frame.
///
/// The control this replaced positioned the thumb with an `AnimatedAlign`
/// inside a `LayoutBuilder` and its callers cross-faded a per-segment
/// background, so the selection blinked across the track instead of
/// travelling. These tests pin the travel itself: it starts where it was, it
/// only ever moves toward the target, it never lands past it, and no single
/// frame swallows the distance.
const _options = [
  OptionStripItem(value: 'a', label: 'Alpha'),
  OptionStripItem(value: 'b', label: 'Beta'),
  OptionStripItem(value: 'c', label: 'Gamma'),
];

const double _stripWidth = 300;
const int _frameMs = 16;
const Duration _frame = Duration(milliseconds: _frameMs);

class _Host extends StatefulWidget {
  const _Host();

  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> {
  String _value = 'a';

  @override
  Widget build(BuildContext context) => Directionality(
    textDirection: TextDirection.ltr,
    child: Center(
      child: SizedBox(
        width: _stripWidth,
        child: SegmentedStrip(
          options: _options,
          activeIndex: _options.indexWhere((o) => o.value == _value),
          onChange: (v) => setState(() => _value = v),
        ),
      ),
    ),
  );
}

/// The thumb's painted rect — it is moved and scaled at paint time, so this
/// reads the transform chain, not the layout.
Rect _thumb(WidgetTester tester) => tester.getRect(
  find.descendant(
    of: find.byType(FractionallySizedBox),
    matching: find.byType(DecoratedBox),
  ),
);

/// The tap target over segment [i] — the labels sit UNDER it, so tapping the
/// text would miss.
Finder _target(int i) => find
    .descendant(
      of: find.byType(SegmentedStrip),
      matching: find.byType(GestureDetector),
    )
    .at(i);

/// Every frame of one full A → C switch, sampled at 16ms.
Future<List<Rect>> _travel(WidgetTester tester) async {
  await tester.pumpWidget(const _Host());
  final samples = <Rect>[_thumb(tester)];
  await tester.tap(_target(2));
  await tester.pump();
  samples.add(_thumb(tester));
  // press (the pop) + emphasis (the slide), plus a frame of slack.
  final frames =
      ((KalloMotion.press + KalloMotion.emphasis).inMilliseconds / _frameMs)
          .ceil() +
      2;
  for (var i = 0; i < frames; i++) {
    await tester.pump(_frame);
    samples.add(_thumb(tester));
  }
  return samples;
}

void main() {
  testWidgets('the thumb travels monotonically and never overshoots', (
    tester,
  ) async {
    final samples = await _travel(tester);
    final start = samples.first.center.dx;
    final end = samples.last.center.dx;
    final distance = end - start;
    expect(distance, greaterThan(0));

    for (var i = 1; i < samples.length; i++) {
      // The CENTRE, not an edge: the pop scales about the centre, so the left
      // edge legitimately steps outward while the thumb grows in place.
      final previous = samples[i - 1].center.dx;
      final current = samples[i].center.dx;
      expect(
        current,
        greaterThanOrEqualTo(previous - 0.01),
        reason: 'frame $i moved backwards: $previous → $current',
      );
      // Landing past the target and easing back is a bounce, not a slide.
      expect(
        current,
        lessThanOrEqualTo(end + 0.01),
        reason: 'frame $i overshot the target segment',
      );
      expect(
        current - previous,
        lessThanOrEqualTo(distance * 0.4 + 0.01),
        reason:
            'frame $i jumped ${current - previous} of $distance — a jump, not '
            'a travel',
      );
    }
  });

  testWidgets('the thumb settles on the segment it was sent to', (
    tester,
  ) async {
    final samples = await _travel(tester);
    await tester.pumpAndSettle();
    // Three segments across the inner track; the last one starts two segments
    // in from the left edge.
    final segment = samples.first.width;
    expect(
      _thumb(tester).center.dx - samples.first.center.dx,
      closeTo(segment * 2, 0.5),
    );
  });

  testWidgets('the thumb pops above 1.0 inside the press window, then eases '
      'back to 1.0', (tester) async {
    await tester.pumpWidget(const _Host());
    final base = _thumb(tester).width;

    await tester.tap(_target(1));
    await tester.pump();

    var peak = base;
    final popFrames = (KalloMotion.press.inMilliseconds / _frameMs).floor();
    for (var i = 0; i < popFrames; i++) {
      await tester.pump(_frame);
      peak = peak > _thumb(tester).width ? peak : _thumb(tester).width;
    }
    // ~1.04: enough to read as the control answering the tap, not as growth.
    expect(peak, greaterThan(base));
    expect(
      peak,
      closeTo(base * SegmentedStrip.thumbPeakScale, base * 0.01),
    );

    await tester.pumpAndSettle();
    expect(_thumb(tester).width, closeTo(base, 0.01));
  });

  testWidgets('nothing is selected: the thumb is absent, not parked', (
    tester,
  ) async {
    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.ltr,
        child: Center(
          child: SizedBox(
            width: _stripWidth,
            child: SegmentedStrip(
              options: _options,
              activeIndex: -1,
              onChange: (_) {},
            ),
          ),
        ),
      ),
    );
    expect(find.byType(FractionallySizedBox), findsNothing);
  });
}
