import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/form/segmented/segmented_strip.dart';
import 'package:kallo_mobile/shared/widgets/form/segmented/segmented_label.dart';
import 'package:kallo_mobile/shared/widgets/form/segmented/segmented_motion.dart';

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
  const _Host({this.refuse});

  /// A value the caller will not take — the scan camera's gated segment.
  final String? refuse;

  @override
  State<_Host> createState() => _HostState();
}

final List<String> _picks = [];

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
          onChange: (v) {
            _picks.add(v);
            if (v != widget.refuse) setState(() => _value = v);
          },
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

/// The centre of segment [i], in global coordinates.
Offset _segment(WidgetTester tester, int i) {
  final strip = tester.getRect(find.byType(SegmentedStrip));
  final width = strip.width / _options.length;
  return Offset(strip.left + width * (i + 0.5), strip.center.dy);
}

/// Moves [finger] by [by] in ten steps, as a real finger reports a drag.
Future<void> _drag(TestGesture finger, Offset by) async {
  for (var i = 0; i < 10; i++) {
    await finger.moveBy(by / 10);
  }
}

/// How far segment [i]'s label has faded.
double _labelOpacity(WidgetTester tester, int i) =>
    tester
        .widget<AnimatedOpacity>(
          find
              .descendant(
                of: find.byType(SegmentedLabel).at(i),
                matching: find.byType(AnimatedOpacity),
              )
              .first,
        )
        .opacity;

/// Every frame of one full A → C switch, sampled at 16ms.
Future<List<Rect>> _travel(WidgetTester tester) async {
  await tester.pumpWidget(const _Host());
  final samples = <Rect>[_thumb(tester)];
  await tester.tapAt(_segment(tester, 2));
  await tester.pump();
  samples.add(_thumb(tester));
  // The spring's settle time, plus a frame of slack.
  final frames = (SegmentedMotion.settle.inMilliseconds / _frameMs).ceil() + 2;
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

  testWidgets('a tap moves the thumb on the next frame, at full size — iOS '
      'has no beat before the slide', (tester) async {
    await tester.pumpWidget(const _Host());
    _picks.clear();
    final before = _thumb(tester);

    await tester.tapAt(_segment(tester, 1));
    await tester.pump();
    await tester.pump(_frame);
    final moving = _thumb(tester);
    expect(moving.center.dx, greaterThan(before.center.dx + 0.5));
    expect(moving.width, closeTo(before.width, 0.01));
    expect(_picks, ['b']);
  });

  testWidgets('holding the thumb shrinks it to 95%; letting go restores it', (
    tester,
  ) async {
    await tester.pumpWidget(const _Host());
    final base = _thumb(tester).width;

    final finger = await tester.startGesture(_segment(tester, 0));
    await tester.pumpAndSettle();
    expect(
      _thumb(tester).width,
      closeTo(base * SegmentedMotion.heldScale, 0.05),
    );

    await finger.up();
    await tester.pumpAndSettle();
    expect(_thumb(tester).width, closeTo(base, 0.01));
  });

  testWidgets('dragging the thumb slides it along and chooses only on '
      'release', (tester) async {
    await tester.pumpWidget(const _Host());
    _picks.clear();
    final start = _thumb(tester).center.dx;

    final finger = await tester.startGesture(_segment(tester, 0));
    await _drag(finger, _segment(tester, 2) - _segment(tester, 0));
    await tester.pumpAndSettle();
    expect(_thumb(tester).center.dx, greaterThan(start + 100));
    expect(_picks, isEmpty, reason: 'nothing is chosen mid-drag');

    await finger.up();
    await tester.pumpAndSettle();
    expect(_picks, ['c']);
  });

  testWidgets('pressing another segment fades its label to 20%; lifting '
      'there chooses it', (tester) async {
    await tester.pumpWidget(const _Host());
    _picks.clear();

    final finger = await tester.startGesture(_segment(tester, 2));
    await tester.pump();
    expect(_labelOpacity(tester, 2), SegmentedLabel.pressedOpacity);
    expect(_labelOpacity(tester, 0), 1, reason: 'the thumb label never fades');

    await finger.up();
    await tester.pumpAndSettle();
    expect(_labelOpacity(tester, 2), 1);
    expect(_picks, ['c']);
  });

  testWidgets('a press dragged well clear of the control chooses nothing', (
    tester,
  ) async {
    await tester.pumpWidget(const _Host());
    _picks.clear();

    final finger = await tester.startGesture(_segment(tester, 2));
    await _drag(finger, const Offset(0, 120));
    await tester.pump();
    expect(_labelOpacity(tester, 2), 1);

    await finger.up();
    await tester.pumpAndSettle();
    expect(_picks, isEmpty);
  });

  testWidgets('a pick the caller refuses sends a dragged thumb back', (
    tester,
  ) async {
    await tester.pumpWidget(const _Host(refuse: 'c'));
    final start = _thumb(tester).center.dx;

    final finger = await tester.startGesture(_segment(tester, 0));
    await _drag(finger, _segment(tester, 2) - _segment(tester, 0));
    await finger.up();
    await tester.pumpAndSettle();
    expect(_thumb(tester).center.dx, closeTo(start, 0.5));
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
