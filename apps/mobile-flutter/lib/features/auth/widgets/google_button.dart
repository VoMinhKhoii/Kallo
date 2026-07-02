import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import 'google_logo.dart';

/// "Continue with Google" button.
///
/// Matches web `components/auth/google-sign-in-button.tsx:42`:
/// `flex w-full items-center justify-center gap-2.5 rounded-xl border
/// border-[#E8D5B5] bg-white px-4 py-3 font-medium text-[#2C2416] text-sm
/// tracking-tight transition-all duration-200 hover:bg-[#FFFCF8]
/// disabled:opacity-60`. While busy a Loader2 spinner (h-4 w-4, currentColor
/// = #2C2416) replaces the logo. rounded-xl → 12, gap-2.5 → 10, px-4 → 16,
/// py-3 → 12.
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
    final fill = _pressed ? NhamColors.cardCream : NhamColors.elev;

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
            horizontal: NhamSpacing.sp4,
            vertical: NhamSpacing.sp3,
          ),
          decoration: BoxDecoration(
            color: fill,
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
            border: Border.all(color: NhamColors.border),
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
                    color: NhamColors.text,
                  ),
                )
              else
                const GoogleLogo(),
              const SizedBox(width: 10), // gap-2.5
              Text(
                tr('auth.dialog.continueWithGoogle'),
                style: dashBody(weight: FontWeight.w500)
                    .copyWith(color: NhamColors.text, letterSpacing: -0.2),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
