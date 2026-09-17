import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_motion.dart';
import '../../../theme/kallo_theme.dart';
import '../../../theme/kallo_typography.dart';
import '../typography/kallo_text.dart';

enum KalloButtonVariant { primary, secondary, danger, ghost, cta }

/// Fully rounded (stadium) buttons, 50pt primaries / 44pt quiet.
///
/// Press feedback is a background color-shift animated over ~150ms,
/// NOT an opacity dim. Disabled dims to 0.55.
class KalloButton extends StatefulWidget {
  const KalloButton({
    super.key,
    required this.title,
    this.onPressed,
    this.variant = KalloButtonVariant.primary,
    this.loading = false,
    this.disabled = false,
    this.animateTitle = false,
    this.compact = false,
  });

  final String title;
  final VoidCallback? onPressed;
  final KalloButtonVariant variant;
  final bool loading;
  final bool disabled;

  /// Cross-fades the label when [title] changes — the onboarding CTA turning
  /// into "Save my plan". Off by default: a label that changes for a different
  /// reason (a count, a countdown) should not dissolve every time.
  final bool animateTitle;

  /// A 36pt button that rides IN a row rather than owning its own line: the
  /// live action on a notification, where a 50pt primary would out-weigh the
  /// message it belongs to.
  ///
  /// A density, not a new variant — it keeps every variant's fill, press
  /// shift, disabled dim and loading spinner. Added because the invite card
  /// had grown a hand-rolled copy of all four that was already drifting (it
  /// had no press state at all).
  final bool compact;

  @override
  State<KalloButton> createState() => _NhamButtonState();
}

class _NhamButtonState extends State<KalloButton> {
  bool _pressed = false;

  bool get _isDisabled => widget.disabled || widget.loading;

  @override
  Widget build(BuildContext context) {
    final variant = widget.variant;

    // Resting + pressed fills per variant. Press = a background color-shift
    // (shadcn `hover:bg-…/90`), not an opacity dim.
    Color? bg;
    BoxBorder? border;
    switch (variant) {
      case KalloButtonVariant.cta:
        bg = _pressed ? KalloColors.btnDarkHover : KalloColors.btnPrimary;
      case KalloButtonVariant.primary:
        bg =
            _pressed
                ? Color.alphaBlend(
                  KalloColors.pressWash,
                  KalloColors.btnPrimarySoft,
                )
                : KalloColors.btnPrimarySoft;
      case KalloButtonVariant.secondary:
        bg = _pressed ? KalloColors.hover : KalloColors.elev;
        border = Border.all(color: KalloColors.border);
      case KalloButtonVariant.danger:
        // hover:bg-kallo-danger/10
        bg = _pressed ? KalloColors.danger10 : Colors.transparent;
      case KalloButtonVariant.ghost:
        bg = _pressed ? KalloColors.pressWash : Colors.transparent;
    }

    // Label color: cta → white, danger → red, else ink.
    final Color labelColor = switch (variant) {
      KalloButtonVariant.cta => KalloColors.elev,
      KalloButtonVariant.danger => KalloColors.danger,
      _ => KalloColors.text,
    };

    final double opacity = _isDisabled ? 0.55 : 1.0;

    final Widget content =
        widget.loading
            ? SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color:
                    variant == KalloButtonVariant.cta
                        ? KalloColors.elev
                        : KalloColors.text,
              ),
            )
            : _label(labelColor);

    return AnimatedOpacity(
      duration: KalloMotion.press,
      curve: KalloEase.press,
      opacity: opacity,
      child: GestureDetector(
        onTapDown: _isDisabled ? null : (_) => setState(() => _pressed = true),
        onTapUp: _isDisabled ? null : (_) => setState(() => _pressed = false),
        onTapCancel:
            _isDisabled ? null : () => setState(() => _pressed = false),
        onTap:
            _isDisabled
                ? null
                : () {
                  // Tactile confirm on every primary/secondary/ghost action.
                  HapticFeedback.lightImpact();
                  widget.onPressed?.call();
                },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          curve: Curves.easeInOut,
          constraints: BoxConstraints(
            minHeight:
                widget.compact
                    ? 36
                    : switch (variant) {
                      KalloButtonVariant.cta ||
                      KalloButtonVariant.primary => 50,
                      _ => 44,
                    },
            minWidth: widget.compact ? 72 : 0,
          ),
          padding: EdgeInsets.symmetric(
            vertical: widget.compact ? KalloSpacing.sp1 : KalloSpacing.sp3,
            horizontal: widget.compact ? KalloSpacing.sp3 : KalloSpacing.sp5,
          ),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(KalloRadii.button),
            border: border,
          ),
          alignment: Alignment.center,
          child: content,
        ),
      ),
    );
  }

  Widget _label(Color color) {
    final Widget text = KalloText(
      widget.title,
      variant: KalloTextVariant.body,
      style: KalloTextStyles.sansSemiBold(
        fontSize: KalloFontSize.md,
      ).copyWith(color: color),
    );
    if (!widget.animateTitle) return text;
    return AnimatedSwitcher(
      duration: KalloMotion.quick,
      // Stacked, not side by side: the CTA must not twitch mid-dissolve.
      layoutBuilder:
          (current, previous) => Stack(
            alignment: Alignment.center,
            children: [...previous, if (current != null) current],
          ),
      child: KeyedSubtree(key: ValueKey(widget.title), child: text),
    );
  }
}
