import 'package:flutter/material.dart';

import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// The composer card's own surface: an opaque white block that lifts off the
/// feed, whose border and accent glow warm as the field takes focus.
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
        final borderColor =
            Color.lerp(
              KalloColors.borderBiscotti40,
              KalloColors.borderAccent40,
              t,
            )!;
        return Container(
          // No padding here — the notice sets its own inset, so the field and
          // controls carry theirs on the column below.
          decoration: BoxDecoration(
            // Opaque: the feed reads through the DOCK, never through the field.
            color: KalloColors.elev,
            borderRadius: BorderRadius.circular(KalloRadii.containerLg),
            border: Border.all(color: borderColor),
            // Ink contact + ambient under the accent glow — what lifts the
            // card off the feed scrolling behind it.
            boxShadow: [
              KalloShadows.md,
              KalloShadows.xs,
              BoxShadow(
                color: KalloColors.accent.withValues(alpha: 0.06 + t * 0.06),
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
