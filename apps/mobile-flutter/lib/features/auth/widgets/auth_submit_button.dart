import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';

/// The email submit button.
///
/// Matches web `components/auth/sign-in-form.tsx:82`:
/// `flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C2416]
/// px-4 py-3 font-medium text-sm text-white tracking-tight transition-all
/// duration-200 hover:bg-[#3D3425] disabled:opacity-60`. While loading a
/// Loader2 spinner (h-4 w-4, white) sits beside the still-visible label.
/// rounded-xl → 12, px-4 → 16, py-3 → 12, gap-2 → 8.
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
    // hover:bg-[#3D3425] → on press lerp the espresso fill toward the hover
    // shade, 200ms.
    final fill = _pressed ? KalloColors.btnDarkHover2 : KalloColors.text;

    return Opacity(
      opacity: widget.busy ? 0.6 : 1.0,
      child: GestureDetector(
        onTapDown: widget.busy ? null : (_) => setState(() => _pressed = true),
        onTapUp: widget.busy ? null : (_) => setState(() => _pressed = false),
        onTapCancel:
            widget.busy ? null : () => setState(() => _pressed = false),
        onTap: widget.busy ? null : widget.onPressed,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(
            horizontal: KalloSpacing.sp4,
            vertical: KalloSpacing.sp3,
          ),
          decoration: BoxDecoration(
            color: fill,
            borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
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
                const SizedBox(width: 8), // gap-2
              ],
              Text(
                widget.label,
                style: dashBody(weight: FontWeight.w500)
                    .copyWith(color: KalloColors.elev, letterSpacing: -0.2),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
