import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';
import 'gold_surface.dart';

/// The buy button, wearing the gold.
///
/// Not a [KalloButton] variant: the gold is deliberately fenced into
/// [GoldPlanSurface] — gradient, hairline, glow, speck field and shimmer —
/// and adding it to the app's button enum would put those hexes back into the
/// general system, which is the thing that file exists to prevent. What is
/// shared instead is the BEHAVIOUR: a press is a colour shift over
/// [KalloMotion.press], disabled dims to 0.55, and the tap fires a light
/// impact — the same three rules `kallo_primitives.dart` states.
class GoldCta extends StatefulWidget {
  const GoldCta({
    required this.label,
    required this.onPressed,
    this.chipLabel,
    this.loading = false,
    this.disabled = false,
    super.key,
  });

  final String label;

  /// The savings pill hanging over the top-right edge — "Save 40%". Absent
  /// when the saving cannot be computed, rather than guessed.
  final String? chipLabel;

  final VoidCallback? onPressed;
  final bool loading;
  final bool disabled;

  /// 52, not the app's 50: it is the one object on the screen the eye is meant
  /// to land on, and it carries a chip over its top edge.
  static const double height = 52;

  @override
  State<GoldCta> createState() => _GoldCtaState();
}

class _GoldCtaState extends State<GoldCta> {
  bool _pressed = false;

  bool get _isDisabled =>
      widget.disabled || widget.loading || widget.onPressed == null;

  @override
  Widget build(BuildContext context) {
    return AnimatedOpacity(
      duration: KalloMotion.press,
      curve: KalloEase.press,
      opacity: _isDisabled ? 0.55 : 1,
      child: GestureDetector(
        onTapDown: _isDisabled ? null : (_) => setState(() => _pressed = true),
        onTapUp: _isDisabled ? null : (_) => setState(() => _pressed = false),
        onTapCancel: _isDisabled ? null : () => setState(() => _pressed = false),
        onTap: _isDisabled
            ? null
            : () {
                HapticFeedback.lightImpact();
                widget.onPressed!.call();
              },
        child: Semantics(
          button: true,
          enabled: !_isDisabled,
          label: widget.label,
          child: SizedBox(
            height: GoldCta.height,
            child: GoldPlanSurface(
              radius: KalloRadii.pill,
              // The chip is the ONLY thing that hangs outside the pill, so it
              // goes when there is nothing to boast.
              chipLabel: widget.chipLabel,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  // A darkening wash rather than a dim: the gold's own
                  // gradient stays readable under it.
                  AnimatedOpacity(
                    duration: KalloMotion.press,
                    curve: KalloEase.press,
                    opacity: _pressed ? 1 : 0,
                    child: const ColoredBox(color: Color(0x1F141413)),
                  ),
                  Center(child: _content()),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Ink on gold, never white: the lightest stop of the gradient is #FBE27A,
  /// where white text falls to 1.3:1.
  Widget _content() => widget.loading
      ? const SizedBox(
          height: 20,
          width: 20,
          child: CircularProgressIndicator(strokeWidth: 2, color: kInk),
        )
      : Text(
          widget.label,
          style: dashBody(weight: FontWeight.w600),
          textAlign: TextAlign.center,
        );
}
