import 'package:flutter/widgets.dart';

/// The warm halo behind the meal composer.
///
/// The composer is the one thing the logging tab asks you to do, and it sat on
/// flat canvas — correct, and completely inert. The halo makes it the screen's
/// lit surface without adding a border, a fill or a shadow to the input itself.
/// The web build carries the same treatment (`--nham-composer-glow`).
class ComposerGlow extends StatelessWidget {
  const ComposerGlow({super.key});

  /// How far the halo reaches ABOVE the dock. It has to clear the scrim band
  /// and then some: the gradient needs room to reach zero alpha before the box
  /// ends, or the box edge is what you see instead of the light.
  static const double bleedTop = 64;

  @override
  Widget build(BuildContext context) {
    // Flutter's RadialGradient is a circle sized off the box's SHORTEST side,
    // so on a dock this wide it would draw a small blob in the middle. Painting
    // the circle and stretching it is how it becomes the broad ellipse the
    // design wants, with no custom GradientTransform to maintain.
    return IgnorePointer(
      child: Transform.scale(
        scaleX: 2.6,
        child: const DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: Alignment(0, 0.35),
              // Flutter measures `radius` against the box's SHORTEST side, so
              // on a box this wide it is the HEIGHT that decides where the
              // fade ends. Anything above ~0.75 leaves alpha on the top edge,
              // and the halo gains a hard horizontal line across the feed.
              radius: 0.65,
              // Alpha only ever DECREASES outward. Layering a gold core over
              // a wider tan wash the way the web gradient does needs two
              // gradients; folded into one stop list it instead paints a tan
              // RING brighter than the middle, which reads as a halo drawn
              // around the input rather than light behind it. So: one ramp
              // that warms from gold-tan to tan as it spreads.
              //
              // The last stop fades to the SAME colour at zero alpha rather
              // than to a bare transparent — interpolating toward
              // transparent-black fringes the halo grey against the cream.
              colors: [_core, _tan, _tanOut],
              stops: [0, 0.5, 0.9],
            ),
          ),
        ),
      ),
    );
  }

  /// Gold and tan mixed, at 44% — the warmest point, right under the input.
  /// Reads lighter than the number suggests: the ramp is tight (see `radius`),
  /// so only the middle of the halo is ever near full strength.
  static const Color _core = Color(0x70DCBB7A);
  static const Color _tan = Color(0x38C9A87C); // tan @ 22%
  static const Color _tanOut = Color(0x00C9A87C);
}
