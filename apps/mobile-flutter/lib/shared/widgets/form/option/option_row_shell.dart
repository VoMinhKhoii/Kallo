import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';

/// Paints a pick row's own surface around its already-padded [body]. [pressed]
/// is the shell's press state, for the surfaces that wash under a finger.
typedef OptionRowSurface =
    Widget Function(BuildContext context, bool pressed, Widget body);

/// The anatomy every pick row shares: a leading radio, the content beside it,
/// and ONE tap target around the pair — `OptionRow` on the onboarding canvas
/// and the paywall's `PlanRow` under its gold.
///
/// The border width is paid for out of the padding (`sp4 - border`), so the
/// content sits at exactly 16 from the outer edge in both states; without that,
/// picking a row nudged its own text 1pt left. The surface is the one thing the
/// two rows do NOT share, so the shell hands its padded body to [surface] and
/// never paints anything itself.
class OptionRowShell extends StatefulWidget {
  const OptionRowShell({
    super.key,
    required this.selected,
    required this.enabled,
    required this.onTap,
    required this.semanticsLabel,
    required this.border,
    required this.surface,
    required this.children,
    this.radioIdleColor = KalloColors.border,
    this.insetVertically = false,
  });

  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  /// The whole row, joined: a radio announces one name, not four labels.
  final String semanticsLabel;

  /// The width [surface] draws its border at — the shell pays it out of the
  /// padding so the content does not move when the border thickens.
  final double border;

  final OptionRowSurface surface;

  /// What sits after the radio.
  final List<Widget> children;

  /// The idle ring's colour — the hairline everywhere except on gold.
  final Color radioIdleColor;

  /// Whether the inset applies to the top and bottom edges too. A fixed-height
  /// row centres its content in the height it was given; a row that sizes to
  /// its content pays the inset on all four sides.
  final bool insetVertically;

  static const double radioSize = 20;
  static const double selectedRing = 6, idleRing = 1.5;
  static const double inset = KalloSpacing.sp4;

  @override
  State<OptionRowShell> createState() => _OptionRowShellState();
}

class _OptionRowShellState extends State<OptionRowShell> {
  bool _pressed = false;

  void _handleTap() {
    // Only a CHANGE is a selection: re-tapping the row you are already on is
    // not a detent, so it does not tick.
    if (!widget.selected) HapticFeedback.selectionClick();
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    final double pad = OptionRowShell.inset - widget.border;
    // Animated, not plain: the padding gives its pixel back to the border in
    // the same breath the border takes it, so the label holds still mid-tween.
    final Widget row = widget.surface(
      context,
      _pressed,
      AnimatedPadding(
        duration: KalloMotion.press,
        curve: KalloEase.press,
        padding: EdgeInsets.symmetric(
          horizontal: pad,
          vertical: widget.insetVertically ? pad : 0,
        ),
        child: Row(
          children: [
            _Radio(selected: widget.selected, idleColor: widget.radioIdleColor),
            const SizedBox(width: KalloSpacing.sp3),
            ...widget.children,
          ],
        ),
      ),
    );

    return Semantics(
      inMutuallyExclusiveGroup: true,
      selected: widget.selected,
      enabled: widget.enabled,
      excludeSemantics: true,
      label: widget.semanticsLabel,
      onTap: widget.enabled ? _handleTap : null,
      child: Opacity(
        opacity: widget.enabled ? 1 : 0.6,
        child: widget.enabled
            ? GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: _handleTap,
                onTapDown: (_) => setState(() => _pressed = true),
                onTapUp: (_) => setState(() => _pressed = false),
                onTapCancel: () => setState(() => _pressed = false),
                child: row,
              )
            : row,
      ),
    );
  }
}

/// 20pt disc whose RING carries the state: a 6px ink ring leaves an 8pt white
/// eye (the classic filled radio read without a second layer), the idle 1.5
/// hairline is the same weight the row's own border is.
class _Radio extends StatelessWidget {
  const _Radio({required this.selected, required this.idleColor});

  final bool selected;
  final Color idleColor;

  @override
  Widget build(BuildContext context) => AnimatedContainer(
    duration: KalloMotion.press,
    curve: KalloEase.press,
    width: OptionRowShell.radioSize,
    height: OptionRowShell.radioSize,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      color: kCardSurface,
      border: Border.all(
        color: selected ? kInk : idleColor,
        width: selected ? OptionRowShell.selectedRing : OptionRowShell.idleRing,
      ),
    ),
  );
}
