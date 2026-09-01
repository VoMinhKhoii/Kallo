import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../../theme/kallo_typography.dart';
import '../typography/kallo_text.dart';

// Screen lives in its own file (size gate); re-exported so the single
// primitives import still reaches every primitive.
export 'kallo_screen.dart';


/// White card separating by surface alone on the `#F8F7F4` canvas — radius
/// 22, NO border, NO shadow (native pass, 2026-08-31; shadows are reserved
/// for true elevation: sheets, menus, the pill nav).
class KalloCard extends StatelessWidget {
  const KalloCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.symmetric(
      horizontal: KalloSpacing.sp4,
      vertical: KalloSpacing.sp3,
    ),
    this.borderRadius,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? BorderRadius.circular(KalloRadii.card);
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: KalloColors.elev,
        borderRadius: radius,
      ),
      child: child,
    );
  }
}

/// Button visual variants (native pass, 2026-08-31).
///
/// [cta] — black & white, AUTH/PAYWALL ONLY (sign in, start free trial).
/// [primary] — beige `#F0EAE0` + ink: every in-app primary (save, share…).
/// [secondary] — quiet: white + hairline.
/// [danger] / [ghost] — unchanged roles.
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
      case KalloButtonVariant.cta:
        bg = _pressed ? KalloColors.btnDarkHover : KalloColors.btnPrimary;
      case KalloButtonVariant.primary:
        bg = _pressed
            ? Color.alphaBlend(KalloColors.pressWash, KalloColors.btnPrimarySoft)
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
          constraints: BoxConstraints(
            minHeight: switch (variant) {
              KalloButtonVariant.cta || KalloButtonVariant.primary => 50,
              _ => 44,
            },
          ),
          padding: const EdgeInsets.symmetric(
            vertical: KalloSpacing.sp3,
            horizontal: KalloSpacing.sp5,
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
}
