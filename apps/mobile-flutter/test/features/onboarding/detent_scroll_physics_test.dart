import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/logic/detent_scroll_physics.dart';

/// The fling path had NO coverage, in the commit named for it.
///
/// `pace_ruler_test` only uses `tester.drag`, which releases at ~zero
/// velocity — so it exercised the "already at rest" branch and never the
/// `FrictionSimulation` endpoint model that is the whole point of the class.
/// `createBallisticSimulation` is pure given a [ScrollMetrics], so it can be
/// pinned directly rather than through a widget.
const double _pitch = 24;

ScrollMetrics _metrics({required double pixels, double max = 2400}) =>
    FixedScrollMetrics(
      minScrollExtent: 0,
      maxScrollExtent: max,
      pixels: pixels,
      viewportDimension: 300,
      axisDirection: AxisDirection.right,
      devicePixelRatio: 3,
    );

/// Where the simulation comes to rest.
double _settlesAt(Simulation sim) {
  var t = 0.0;
  while (!sim.isDone(t) && t < 30) {
    t += 1 / 60;
  }
  return sim.x(t);
}

void main() {
  // Composed the way Flutter composes it in the widget tree: `applyTo` hands
  // the platform physics in as the parent. A BARE instance has no parent, so
  // `super.createBallisticSimulation` returns null and the out-of-range
  // hand-off silently does nothing — which is exactly what this harness got
  // wrong first time round.
  final physics = const DetentScrollPhysics(
    pitch: _pitch,
  ).applyTo(const BouncingScrollPhysics());

  test('a hard fling lands exactly on a graduation', () {
    final sim = physics.createBallisticSimulation(
      _metrics(pixels: 120),
      2400, // px/s — a real throw
    );
    expect(sim, isNotNull);

    final rest = _settlesAt(sim!);
    expect(
      rest % _pitch,
      closeTo(0, 0.5),
      reason: 'settled at $rest, which is not a multiple of $_pitch',
    );
  });

  test('a hard fling still travels — momentum is preserved, not clamped', () {
    final sim = physics.createBallisticSimulation(_metrics(pixels: 120), 2400)!;
    // The distinction that matters: this is NOT PageScrollPhysics snapping to
    // the adjacent detent. A real throw covers real ground.
    expect(_settlesAt(sim) - 120, greaterThan(_pitch * 4));
  });

  test('direction is honoured', () {
    final forward = _settlesAt(
      physics.createBallisticSimulation(_metrics(pixels: 1200), 1800)!,
    );
    final back = _settlesAt(
      physics.createBallisticSimulation(_metrics(pixels: 1200), -1800)!,
    );
    expect(forward, greaterThan(1200));
    expect(back, lessThan(1200));
  });

  test('resting exactly on a detent schedules nothing', () {
    // `goBallistic(null)` idles the position; returning a simulation here
    // would make the strip creep.
    expect(
      physics.createBallisticSimulation(_metrics(pixels: _pitch * 5), 0),
      isNull,
    );
  });

  test('released between detents at rest, it still closes the gap', () {
    final sim = physics.createBallisticSimulation(
      _metrics(pixels: _pitch * 5 + 9),
      0,
    );
    expect(sim, isNotNull);
    expect(_settlesAt(sim!) % _pitch, closeTo(0, 0.5));
  });

  test('a fling past the end is clamped to the last graduation', () {
    final sim = physics.createBallisticSimulation(
      _metrics(pixels: 2350),
      9000, // far beyond maxScrollExtent
    );
    expect(_settlesAt(sim!), lessThanOrEqualTo(2400));
  });

  test('out of range, the parent keeps its rubber-band', () {
    // Past the edge and still travelling outward: the detent path must defer,
    // or the bounce would be replaced by a spring to a clamped detent.
    final sim = physics.createBallisticSimulation(_metrics(pixels: 2500), 600);
    expect(sim, isA<Simulation>());
  });
}
