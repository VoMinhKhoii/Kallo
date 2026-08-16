import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../theme/kallo_colors.dart';
import '../../theme/kallo_theme.dart';
import '../../theme/kallo_typography.dart';
import 'kallo_text.dart';

// Screen lives in its own file (size gate); re-exported so the single
// primitives import still reaches every primitive.
export 'kallo_screen.dart';


/// White card with a hairline border (hierarchy from borders, not elevation).
///
/// RN port of `Card`. `borderRadius: radii['2xl']` (18), `padding: space[4]`
/// (16), 1px [border] hairline, and the warm low-contrast [KalloShadows.xs].
class KalloCard extends StatelessWidget {
  const KalloCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(KalloSpacing.sp4),
    this.borderRadius,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? BorderRadius.circular(KalloRadii.xxl);
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: KalloColors.elev,
        borderRadius: radius,
        border: Border.all(color: KalloColors.border),
        boxShadow: const [KalloShadows.xs],
      ),
      child: child,
    );
  }
}

/// Button visual variants — RN `'primary' | 'secondary' | 'danger' | 'ghost'`.
enum KalloButtonVariant { primary, secondary, danger, ghost }

/// RN port of `Button`. `borderRadius: radii.xl` (14), `paddingVertical:
/// space[4]` (16), `paddingHorizontal: space[5]` (20), centered label.
///
/// Press feedback follows the shadcn button affordance — a background
/// color-shift (e.g. `kallo-btn` → `kallo-btn-hover`) animated over ~150ms
/// (`transition-all`), NOT an opacity dim. Disabled dims to 0.55.
class KalloButton extends StatefulWidget {
  const KalloButton({
    super.key,
    required this.title,
    this.onPressed,
    this.variant = KalloButtonVariant.primary,
    this.loading = false,
    this.disabled = false,
  });

  final String title;
  final VoidCallback? onPressed;
  final KalloButtonVariant variant;
  final bool loading;
  final bool disabled;

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
      case KalloButtonVariant.primary:
        bg = _pressed ? KalloColors.btnHover : KalloColors.btn;
      case KalloButtonVariant.secondary:
        bg = _pressed ? KalloColors.hover : KalloColors.elev;
        border = Border.all(color: KalloColors.border);
      case KalloButtonVariant.danger:
        // hover:bg-kallo-danger/10
        bg = _pressed ? KalloColors.danger10 : Colors.transparent;
      case KalloButtonVariant.ghost:
        bg = _pressed ? KalloColors.pressWash : Colors.transparent;
    }

    // Label color: primary → white, danger → red, else espresso text.
    final Color labelColor = switch (variant) {
      KalloButtonVariant.primary => KalloColors.elev,
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
                    variant == KalloButtonVariant.primary
                        ? KalloColors.elev
                        : KalloColors.btn,
              ),
            )
            : KalloText(
              widget.title,
              variant: KalloTextVariant.body,
              style: KalloTextStyles.sansSemiBold(
                fontSize: KalloFontSize.md,
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
            vertical: KalloSpacing.sp4,
            horizontal: KalloSpacing.sp5,
          ),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(KalloRadii.xl),
            border: border,
          ),
          alignment: Alignment.center,
          child: content,
        ),
      ),
    );
  }
}
