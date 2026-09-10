import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';
import 'gold_surface.dart';

/// The buy button. ONE widget for both periods — [gold] only changes what it
/// is painted on.
///
/// It used to be two: a gold widget for the yearly plan and a plain
/// [KalloButton] for the monthly one, chosen by a fork in the band. That fork
/// leaked — every assertion about the buy button had to ask which kind it was
/// first, and the two shipped different heights (52 and 50) into the same
/// slot, so the band twitched when the toggle moved.
///
/// Not a [KalloButtonVariant]: the gold is deliberately fenced into
/// [GoldPlanSurface] — gradient, hairline, glow, speck field and shimmer —
/// and adding it to the app's button enum would put those hexes back into the
/// general system, which is the thing that file exists to prevent. The
/// BEHAVIOUR still comes from the shared button: a press is a colour shift
/// over [KalloMotion.press], disabled dims to 0.55, and the tap fires a light
/// impact.
class PlanCta extends StatefulWidget {
  const PlanCta({
    required this.label,
    required this.onPressed,
    required this.gold,
    this.chipLabel,
    this.loading = false,
    this.disabled = false,
    super.key,
  });

  final String label;

  /// The yearly plan is the deal, so it is the one that wears the gold. The
  /// monthly plan gets the app's ordinary ink CTA — same box, same height,
  /// same press.
  final bool gold;

  /// The savings pill hanging over the top-right edge — "Save 40%". Absent on
  /// the monthly plan, and whenever the saving cannot be computed.
  final String? chipLabel;

  final VoidCallback? onPressed;
  final bool loading;
  final bool disabled;

  /// 52, not the app's 50: it is the one object on the screen the eye is meant
  /// to land on, and it carries a chip over its top edge. BOTH faces use it,
  /// so the band's height does not change when the period does.
  static const double height = 52;

  @override
  State<PlanCta> createState() => _PlanCtaState();
}

class _PlanCtaState extends State<PlanCta> {
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
                widget.onPressed?.call();
              },
        child: Semantics(
          button: true,
          enabled: !_isDisabled,
          label: widget.label,
          child: SizedBox(height: PlanCta.height, child: _surface()),
        ),
      ),
    );
  }

  /// The gold treatment, or the app's ink pill — the only thing [PlanCta.gold]
  /// decides. The press wash rides INSIDE either one, so the pressed state is
  /// one code path.
  Widget _surface() {
    final Widget body = Stack(
      fit: StackFit.expand,
      children: [
        // A darkening wash rather than a dim: whatever is underneath stays
        // readable through it.
        AnimatedOpacity(
          duration: KalloMotion.press,
          curve: KalloEase.press,
          opacity: _pressed ? 1 : 0,
          child: ColoredBox(
            color: widget.gold
                ? KalloColors.pressWashOnGold
                : KalloColors.pressWashOnInk,
          ),
        ),
        Center(child: _content()),
      ],
    );
    if (widget.gold) {
      return GoldPlanSurface(
        radius: KalloRadii.pill,
        // The chip is the ONLY thing that hangs outside the pill.
        chipLabel: widget.chipLabel,
        child: body,
      );
    }
    return DecoratedBox(
      decoration: BoxDecoration(
        color: KalloColors.btnPrimary,
        borderRadius: BorderRadius.circular(KalloRadii.pill),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(KalloRadii.pill),
        child: body,
      ),
    );
  }

  /// Ink on gold and white on ink — never white on gold: the lightest stop of
  /// the gradient is #FBE27A, where white text falls to 1.3:1.
  Color _ink() => widget.gold ? kInk : KalloColors.elev;

  Widget _content() => widget.loading
      ? SizedBox(
          height: 20,
          width: 20,
          child: CircularProgressIndicator(strokeWidth: 2, color: _ink()),
        )
      : Text(
          widget.label,
          style: dashBody(color: _ink(), weight: FontWeight.w600),
          textAlign: TextAlign.center,
        );
}
