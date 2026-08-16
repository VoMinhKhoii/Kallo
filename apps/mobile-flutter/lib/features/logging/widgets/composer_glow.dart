import 'package:flutter/widgets.dart';

/// The warm halo behind the meal composer.
///
/// The composer is the one thing the logging tab asks you to do, and it sat on
/// flat canvas — correct, and completely inert. The halo makes it the screen's
/// lit surface without adding a border, a fill or a shadow to the input itself.
/// The web build carries the same treatment (`--kallo-composer-glow`).
class ComposerGlow extends StatelessWidget {
  const ComposerGlow({super.key});

  /// How far the halo reaches ABOVE the dock's opaque base.
  ///
  /// Exactly [ComposerDock.scrimHeight], and it must not grow past it. The dock
  /// floats OVER the feed, so anything the halo paints above the scrim lands on
  /// meal cards that are still fully opaque and tints them tan — at 140 the
  /// bottom two cards went visibly warm and the last one nearly disappeared.
  /// Stopping at the scrim means the halo fades in over exactly the band where
  /// the scrim is fading cards out: content and light cross over, which is what
  /// makes the join invisible.
  static const double bleedTop = 32;

  /// How far it reaches past the dock's other three edges. Sideways this only
  /// has to beat the dock's own padding; downward it covers the home-indicator
  /// inset, and the keyboard covers whatever is left when it is open.
  static const double bleedEdge = 48;

  @override
  Widget build(BuildContext context) {
    // Flutter's RadialGradient is a circle sized off the box's SHORTEST side,
    // so on a dock this wide it would draw a small blob in the middle. Painting
    // the circle and stretching it is how it becomes the broad ellipse the
    // design wants, with no custom GradientTransform to maintain.
    return IgnorePointer(
      child: Transform.scale(
        // Wide enough that the light reaches both screen edges. A halo that
        // stops short of them reads as a blob centred on the input instead of
        // as the surface under it being lit.
        scaleX: 3.2,
        child: const DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              // Sat lower than centre, which buys the fade room to finish.
              // Alignment y=0.45 is 72.5% down the box, so there is 0.725 of
              // the height above it.
              center: Alignment(0, 0.45),
              // Flutter measures `radius` against the box's SHORTEST side, so
              // on a box this wide it is the HEIGHT that decides where the fade
              // ends: it reaches 0.62 of the height, a clear 0.1 short of the
              // top edge. At 0.7 from a higher centre that margin was under
              // 0.05, and the alpha still left on the edge drew a faint line
              // across the feed — the seam this whole shape exists to avoid.
              radius: 0.62,
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
              // The tail runs all the way to the edge of the gradient rather
              // than stopping at 0.9: ending early puts a corner in the ramp,
              // and a corner is visible as a ring even where the alpha is 0.
              colors: [_core, _tan, _tanOut],
              stops: [0, 0.45, 1],
            ),
          ),
        ),
      ),
    );
  }

  /// Gold and tan mixed, at 48% — the warmest point, right under the input.
  /// Reads lighter than the number suggests: it is the peak of a ramp spread
  /// over the whole lower third of the screen, never a flat fill.
  static const Color _core = Color(0x7ADCBB7A);
  static const Color _tan = Color(0x3DC9A87C); // tan @ 24%
  static const Color _tanOut = Color(0x00C9A87C);
}
