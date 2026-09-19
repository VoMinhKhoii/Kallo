import 'package:flutter/physics.dart';
import 'package:flutter/widgets.dart';

/// Scroll physics whose fling lands ON a graduation, in one motion.
///
/// `pace_ruler` is a horizontal `SingleChildScrollView` with a needle painted
/// over the centre, and it used to settle in **two visible stages**: the fling
/// decelerated to a complete stop wherever it happened to land, and only then
/// did a separate 200ms `animateTo` slide it onto the nearest graduation. iOS
/// pickers never do this — the deceleration curve itself terminates on the
/// detent, so there is one motion, not two.
///
/// Only `pace_ruler` gets these physics. The portion strip is NOT a detented
/// control despite looking like one: its value is grams off the piecewise
/// scale in `ruler_scale.dart` at 1 g resolution, which does not line up with
/// the graduations, so snapping quantizes the committed grams — a 665 g bowl
/// lands on the next tier, which `portion_picker_test` catches. Its
/// graduations are a tape measure, and a tape measure does not snap; the
/// per-graduation haptic is what makes it feel physical instead.
///
/// The fix is to decide the landing point BEFORE the ball starts rolling.
/// [createBallisticSimulation] models where the fling would naturally end
/// using the same `FrictionSimulation(0.135, …)` that Flutter's own
/// [BouncingScrollSimulation] uses on iOS (`scroll_simulation.dart`), rounds
/// that endpoint to the nearest detent, and springs there. Momentum is
/// preserved — a hard fling still travels a long way — it just arrives
/// somewhere meaningful.
class DetentScrollPhysics extends ScrollPhysics {
  const DetentScrollPhysics({required this.pitch, super.parent});

  /// Logical pixels between two graduations. Must be > 0.
  final double pitch;

  /// The drag constant `BouncingScrollSimulation` uses for the iOS fling
  /// (`0.998^1000 ≈ 0.135`). Matching it is what makes the modelled endpoint
  /// agree with where the platform would actually have stopped.
  static const double _iosFrictionDrag = 0.135;

  @override
  DetentScrollPhysics applyTo(ScrollPhysics? ancestor) =>
      DetentScrollPhysics(pitch: pitch, parent: buildParent(ancestor));

  /// Nearest graduation to [pixels], clamped into the scrollable's range.
  double detentFor(ScrollMetrics position, double pixels) {
    if (pitch <= 0) return pixels;
    final snapped = (pixels / pitch).roundToDouble() * pitch;
    return snapped.clamp(position.minScrollExtent, position.maxScrollExtent);
  }

  @override
  Simulation? createBallisticSimulation(
    ScrollMetrics position,
    double velocity,
  ) {
    // Out of range in the direction of travel: hand back to the parent so the
    // rubber-band still rubber-bands. Snapping here would fight it.
    if ((velocity <= 0.0 && position.pixels <= position.minScrollExtent) ||
        (velocity >= 0.0 && position.pixels >= position.maxScrollExtent)) {
      return super.createBallisticSimulation(position, velocity);
    }

    final tolerance = toleranceFor(position);

    // Where an untouched iOS fling would come to rest.
    final natural =
        velocity.abs() < tolerance.velocity
            ? position.pixels
            : FrictionSimulation(
              _iosFrictionDrag,
              position.pixels,
              velocity,
            ).finalX;

    final target = detentFor(position, natural);

    // Already on a graduation and not going anywhere: no simulation at all,
    // so the position rests exactly rather than creeping.
    if ((target - position.pixels).abs() < tolerance.distance &&
        velocity.abs() < tolerance.velocity) {
      return null;
    }

    return ScrollSpringSimulation(
      spring,
      position.pixels,
      target,
      velocity,
      tolerance: tolerance,
    );
  }

  /// Rulers are dragged, not paged, and a fling that leaves the finger should
  /// keep travelling — so an implicit scroll is never suppressed.
  @override
  bool get allowImplicitScrolling => false;
}
