import 'package:flutter/widgets.dart';

import '../../shared/widgets/brand/wordmark_glyphs.dart';

/// Where one letter is, relative to where it rests in the wordmark.
///
/// Only what the intro actually moves. Offsets are in wordmark units, so the
/// choreography reads the same on every screen size.
@immutable
class GlyphPose {
  const GlyphPose({
    this.dx = 0,
    this.dy = 0,
    this.scaleX = 1,
    this.scaleY = 1,
    this.aboutCentre = false,
  });

  /// Offset from the resting position; positive is right and down.
  final double dx;
  final double dy;

  /// Scale about the letter's foot (the middle of its baseline), or about its
  /// centre when [aboutCentre] — a blink closes towards the middle.
  final double scaleX;
  final double scaleY;
  final bool aboutCentre;

  static const GlyphPose rest = GlyphPose();

  GlyphPose shifted(double by) => GlyphPose(
    dx: dx + by,
    dy: dy,
    scaleX: scaleX,
    scaleY: scaleY,
    aboutCentre: aboutCentre,
  );
}

/// How wordmark units land on the screen: the unit point [focus] sits on the
/// screen point [anchor], at [scale] points per unit.
@immutable
class WordmarkStage {
  const WordmarkStage({
    required this.anchor,
    required this.focus,
    required this.scale,
  });

  /// The resting stage: the K alone would sit dead centre, exactly where the
  /// native launch screen draws it.
  WordmarkStage.rest(Size screen)
    : this(
        anchor: screen.center(Offset.zero),
        focus: restFocus,
        scale: restScale,
      );

  /// Height of the K on the native launch screen, in points.
  /// `scripts/assets/gen-splash-mark.mjs` renders the launch image at this
  /// height (`BASE_PT`); the two must agree or the handoff visibly jumps.
  static const double launchMarkHeight = 72;

  /// Points per wordmark unit at rest; the K is 708 units tall.
  static const double restScale = launchMarkHeight / 708;

  /// The unit point pinned to the screen centre at rest: the wordmark's ink
  /// centre across, the K's centre down. So the assembled word is centred,
  /// and the K starting alone in the middle only ever travels straight left.
  static const Offset restFocus = Offset(1090, 422);

  final Offset anchor;
  final Offset focus;
  final double scale;

  /// Where the wordmark unit point [unit] lands on the screen.
  Offset toScreen(Offset unit) => anchor + (unit - focus) * scale;

  /// The canvas transform that paints [glyph] in [pose] on this stage.
  Matrix4 transformFor(WordmarkGlyph glyph, GlyphPose pose) {
    final box = WordmarkGlyphs.bounds[glyph]!;
    final pivot =
        pose.aboutCentre
            ? box.center
            : Offset(box.center.dx, WordmarkGlyphs.baseline);
    return Matrix4.translationValues(anchor.dx, anchor.dy, 0)
      ..multiply(Matrix4.diagonal3Values(scale, scale, 1))
      ..multiply(
        Matrix4.translationValues(
          pose.dx - focus.dx + pivot.dx,
          pose.dy - focus.dy + pivot.dy,
          0,
        ),
      )
      ..multiply(Matrix4.diagonal3Values(pose.scaleX, pose.scaleY, 1))
      ..multiply(Matrix4.translationValues(-pivot.dx, -pivot.dy, 0));
  }
}
