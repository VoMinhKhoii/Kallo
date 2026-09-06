import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import 'auth_controls.dart' show kAuthButtonHeight;

/// The email submit button — the auth CTA tier (native pass, 2026-08-31):
/// ink fill, white 14/600, 50pt, fully rounded. Same two-tier rule as the
/// paywall's "Start free trial": black and white is reserved for the moment
/// someone commits to an account or a purchase, and every in-app primary is
/// beige-and-ink instead.
///
/// Not [KalloButton] itself only because this one keeps its label visible
/// BESIDE the spinner: a sign-in that swapped its label for a spinner reads
/// as a button that lost its purpose mid-tap.
class AuthSubmitButton extends StatefulWidget {
  const AuthSubmitButton({
    super.key,
    required this.label,
    required this.onPressed,
    required this.busy,
    this.loading = false,
  });

  final String label;
  final VoidCallback onPressed;

  /// Any auth request is in flight — disables + dims the button.
  final bool busy;

  /// This button's own action is in flight — shows the spinner beside the label.
  final bool loading;

  @override
  State<AuthSubmitButton> createState() => _AuthSubmitButtonState();
}

class _AuthSubmitButtonState extends State<AuthSubmitButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    // Press = a background colour-shift toward the CTA's hover shade, not an
    // opacity dim — the app-wide press affordance.
    final fill = _pressed ? KalloColors.btnDarkHover : KalloColors.btnPrimary;

    return Opacity(
      opacity: widget.busy ? 0.6 : 1.0,
      child: Semantics(
        button: true,
        enabled: !widget.busy,
        label: widget.label,
        excludeSemantics: true,
        child: GestureDetector(
          onTapDown:
              widget.busy ? null : (_) => setState(() => _pressed = true),
          onTapUp: widget.busy ? null : (_) => setState(() => _pressed = false),
          onTapCancel:
              widget.busy ? null : () => setState(() => _pressed = false),
          onTap: widget.busy ? null : widget.onPressed,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            constraints: const BoxConstraints(minHeight: kAuthButtonHeight),
            padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp4),
            decoration: BoxDecoration(
              color: fill,
              borderRadius: BorderRadius.circular(KalloRadii.button),
            ),
            alignment: Alignment.center,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (widget.loading) ...[
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: KalloColors.elev,
                    ),
                  ),
                  const SizedBox(width: KalloSpacing.sp2),
                ],
                Text(
                  widget.label,
                  style: dashBody(
                    weight: FontWeight.w600,
                  ).copyWith(color: KalloColors.elev, letterSpacing: -0.2),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
