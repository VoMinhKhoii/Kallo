import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../auth_controls.dart' show kAuthButtonHeight;
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../shared/widgets/brand/google_logo.dart';

/// "Continue with Google" button.
///
/// Matches web `components/auth/google-sign-in-button.tsx:42`:
/// `flex w-full items-center justify-center gap-2.5 rounded-xl border
/// border-[#E8E6DC] bg-white px-4 py-3 font-medium text-[#2C2416] text-sm
/// tracking-tight transition-all duration-200 hover:bg-[#FFFCF8]
/// disabled:opacity-60`. While busy a Loader2 spinner (h-4 w-4, currentColor
/// = #2C2416) replaces the logo. rounded-xl → 12, gap-2.5 → 10, px-4 → 16,
/// py-3 → 12. Restyled to the canvas' 50pt full-round pill in the native pass
/// (2026-08-31) — see [kAuthButtonHeight].
class GoogleButton extends StatefulWidget {
  const GoogleButton({
    super.key,
    required this.onPressed,
    required this.busy,
    this.loading = false,
  });

  final VoidCallback onPressed;

  /// Any auth request is in flight — disables + dims the button.
  final bool busy;

  /// Google is the in-flight action — swaps the logo for a spinner.
  final bool loading;

  @override
  State<GoogleButton> createState() => _GoogleButtonState();
}

class _GoogleButtonState extends State<GoogleButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    // hover:bg-[#FFFCF8] → on press lerp the fill white → cream tint, 200ms.
    final fill = _pressed ? KalloColors.cardCream : KalloColors.elev;

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
          constraints: const BoxConstraints(minHeight: kAuthButtonHeight),
          padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp4),
          decoration: BoxDecoration(
            color: fill,
            borderRadius: BorderRadius.circular(KalloRadii.button),
            border: Border.all(color: KalloColors.border),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.loading)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: KalloColors.text,
                  ),
                )
              else
                const GoogleLogo(),
              const SizedBox(width: 10), // gap-2.5
              Text(
                tr('auth.dialog.continueWithGoogle'),
                style: dashBody(
                  weight: FontWeight.w600,
                ).copyWith(color: KalloColors.text, letterSpacing: -0.2),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
