import 'package:flutter/material.dart';

import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// The composer card's own surface: an opaque white block on the dock, which
/// grows a tan focus ring as the field takes focus.
///
/// Flat and borderless at rest since the native pass — a white card on the
/// `#F8F7F4` canvas separates by surface alone, and the dock beneath it is
/// already an opaque band, so the lift had nothing left to lift off. Tan is a
/// focus-ring colour in this system, which is the one thing the border still
/// says.
///
/// Split out of `meal_input.dart` because none of it touches the field's state
/// — it needs the focus animation and nothing else. Keeping it here also means
/// the `child` is built ONCE and handed through `AnimatedBuilder`'s child slot,
/// so the whole composer column does not rebuild on every frame of the
/// focus crossfade.
class ComposerCardSurface extends StatelessWidget {
  const ComposerCardSurface({
    super.key,
    required this.focus,
    required this.child,
  });

  /// 0 = resting, 1 = focused. Drives both the border lerp and the glow.
  final Animation<double> focus;

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: focus,
      child: child,
      builder: (context, child) {
        final t = focus.value;
        // Transparent at rest rather than absent, so the card's size never
        // changes as the ring arrives.
        final borderColor =
            Color.lerp(
              const Color(0x00000000),
              KalloColors.borderAccent40,
              t,
            )!;
        return Container(
          // No padding here — the notice sets its own inset, so the field and
          // controls carry theirs on the column below.
          decoration: BoxDecoration(
            // Opaque: the feed reads through the DOCK, never through the field.
            color: KalloColors.elev,
            borderRadius: BorderRadius.circular(KalloRadii.card),
            border: Border.all(color: borderColor),
            // The only lift left, and only while focused: the field is the one
            // live control on the screen while the keyboard is up.
            boxShadow: [
              BoxShadow(
                color: KalloColors.accent.withValues(alpha: t * 0.10),
                blurRadius: 20,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: child,
        );
      },
    );
  }
}
