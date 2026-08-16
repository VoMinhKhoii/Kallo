import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../theme/nham_colors.dart';
import '../../theme/nham_theme.dart';
import '../../theme/nham_typography.dart';
import 'nham_text.dart';

// Screen lives in its own file (size gate); re-exported so the single
// primitives import still reaches every primitive.
export 'nham_screen.dart';


/// White card with a hairline border (hierarchy from borders, not elevation).
///
/// RN port of `Card`. `borderRadius: radii['2xl']` (18), `padding: space[4]`
/// (16), 1px [border] hairline, and the warm low-contrast [NhamShadows.xs].
class NhamCard extends StatelessWidget {
  const NhamCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(NhamSpacing.sp4),
    this.borderRadius,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? BorderRadius.circular(NhamRadii.xxl);
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: NhamColors.elev,
        borderRadius: radius,
        border: Border.all(color: NhamColors.border),
        boxShadow: const [NhamShadows.xs],
      ),
      child: child,
    );
  }
}

/// Button visual variants — RN `'primary' | 'secondary' | 'danger' | 'ghost'`.
enum NhamButtonVariant { primary, secondary, danger, ghost }

/// RN port of `Button`. `borderRadius: radii.xl` (14), `paddingVertical:
/// space[4]` (16), `paddingHorizontal: space[5]` (20), centered label.
///
/// Press feedback follows the shadcn button affordance — a background
/// color-shift (e.g. `kallo-btn` → `kallo-btn-hover`) animated over ~150ms
/// (`transition-all`), NOT an opacity dim. Disabled dims to 0.55.
class NhamButton extends StatefulWidget {
  const NhamButton({
    super.key,
    required this.title,
    this.onPressed,
    this.variant = NhamButtonVariant.primary,
    this.loading = false,
    this.disabled = false,
  });

  final String title;
  final VoidCallback? onPressed;
  final NhamButtonVariant variant;
  final bool loading;
  final bool disabled;

  @override
  State<NhamButton> createState() => _NhamButtonState();
}

class _NhamButtonState extends State<NhamButton> {
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
      case NhamButtonVariant.primary:
        bg = _pressed ? NhamColors.btnHover : NhamColors.btn;
      case NhamButtonVariant.secondary:
        bg = _pressed ? NhamColors.hover : NhamColors.elev;
        border = Border.all(color: NhamColors.border);
      case NhamButtonVariant.danger:
        // hover:bg-kallo-danger/10
        bg = _pressed ? NhamColors.danger10 : Colors.transparent;
      case NhamButtonVariant.ghost:
        bg = _pressed ? NhamColors.pressWash : Colors.transparent;
    }

    // Label color: primary → white, danger → red, else espresso text.
    final Color labelColor = switch (variant) {
      NhamButtonVariant.primary => NhamColors.elev,
      NhamButtonVariant.danger => NhamColors.danger,
      _ => NhamColors.text,
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
                    variant == NhamButtonVariant.primary
                        ? NhamColors.elev
                        : NhamColors.btn,
              ),
            )
            : NhamText(
              widget.title,
              variant: NhamTextVariant.body,
              style: NhamTextStyles.sansSemiBold(
                fontSize: NhamFontSize.md,
              ).copyWith(color: labelColor),
            );

    return Opacity(
      opacity: opacity,
      child: GestureDetector(
        onTapDown: _isDisabled ? null : (_) => setState(() => _pressed = true),
        onTapUp: _isDisabled ? null : (_) => setState(() => _pressed = false),
        onTapCancel:
            _isDisabled ? null : () => setState(() => _pressed = false),
        onTap: _isDisabled
            ? null
            : () {
                // Tactile confirm on every primary/secondary/ghost action.
                HapticFeedback.lightImpact();
                widget.onPressed?.call();
              },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          curve: Curves.easeInOut,
          padding: const EdgeInsets.symmetric(
            vertical: NhamSpacing.sp4,
            horizontal: NhamSpacing.sp5,
          ),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(NhamRadii.xl),
            border: border,
          ),
          alignment: Alignment.center,
          child: content,
        ),
      ),
    );
  }
}
