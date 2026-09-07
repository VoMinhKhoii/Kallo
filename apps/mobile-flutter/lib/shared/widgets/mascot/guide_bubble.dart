import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';

/// The white speech bubble beside the bun: the typed prefix of a line, a caret
/// and a small left-pointing tail. Stateless on purpose — the typewriter clock
/// lives in `BunMascot`, which already runs a [Ticker] and needs every revealed
/// grapheme to drive the visemes.
class GuideBubble extends StatelessWidget {
  const GuideBubble({
    super.key,
    required this.text,
    required this.revealed,
    required this.caretOn,
  });

  /// The WHOLE line — [revealed] says how much of it is on screen.
  final String text;

  /// Grapheme clusters revealed so far. At `text.characters.length` the line
  /// is finished and the caret goes away.
  final int revealed;

  /// The caret's blink phase. Only read while the line is still typing.
  final bool caretOn;

  @override
  Widget build(BuildContext context) {
    final chars = text.characters;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          decoration: BoxDecoration(
            color: kCardSurface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: KalloColors.border),
            boxShadow: kCardShadows,
          ),
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
          // The FULL line, not the typed prefix: the live region announces
          // the sentence once instead of thirty times a second.
          child: Semantics(
            liveRegion: true,
            label: text,
            child: ExcludeSemantics(
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(text: chars.take(revealed).string),
                    if (revealed < chars.length) _caret,
                  ],
                ),
                style: dashMeta(color: kInk),
              ),
            ),
          ),
        ),
        // The tail: a 10px square rotated 45°, bordered on the left and
        // bottom edges — the two the rotation swings to the leftmost point.
        // Its white fill covers the bubble's own border where they overlap.
        Positioned(
          left: -5,
          top: 22,
          width: 10,
          height: 10,
          child: Transform.rotate(
            angle: math.pi / 4,
            child: const DecoratedBox(
              decoration: BoxDecoration(
                color: kCardSurface,
                border: Border(
                  left: BorderSide(color: KalloColors.border),
                  bottom: BorderSide(color: KalloColors.border),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Always in the span while typing — toggling its opacity, not its presence,
  /// keeps the last character from shuffling sideways twice a second.
  InlineSpan get _caret => WidgetSpan(
    alignment: PlaceholderAlignment.middle,
    child: Opacity(
      opacity: caretOn ? 1 : 0,
      child: Container(
        width: 1,
        height: 14,
        margin: const EdgeInsets.only(left: 2),
        color: kInkMuted,
      ),
    ),
  );
}
