import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';

/// "Continue with Apple" — a custom button matching the Google / email buttons.
///
/// Built to be identical in font, size and shape to the other auth buttons; the
/// ONLY thing it keeps from Apple's styling is the colour (black fill, white
/// logo + label). The mark is Apple's genuine logo glyph (U+F8FF) rendered from
/// the iOS system font — not a hand-traced path — so it stays authentic.
///
/// Note: this is a hand-rolled button rather than the system
/// `SignInWithAppleButton`, so it intentionally diverges from Apple's HIG
/// "use the provided button" guidance in favour of a unified button stack.
class AppleButton extends StatefulWidget {
  const AppleButton({super.key, required this.onPressed, required this.busy});

  final VoidCallback onPressed;

  /// Any auth request is in flight — dims + blocks the button.
  final bool busy;

  @override
  State<AppleButton> createState() => _AppleButtonState();
}

class _AppleButtonState extends State<AppleButton> {
  bool _pressed = false;

  // Apple's button black, and a slightly lighter shade for the pressed state.
  static const Color _black = Color(0xFF000000);
  static const Color _blackPressed = Color(0xFF1C1C1E);

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: widget.busy ? 0.6 : 1.0,
      child: GestureDetector(
        onTapDown:
            widget.busy ? null : (_) => setState(() => _pressed = true),
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
            color: _pressed ? _blackPressed : _black,
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Apple's genuine logo glyph from the iOS system font.
              const Text(
                '\u{F8FF}',
                style: TextStyle(
                  fontFamily: '.SF Pro Text',
                  fontSize: 19,
                  height: 1,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                tr('auth.dialog.continueWithApple'),
                style: dashBody(weight: FontWeight.w500)
                    .copyWith(color: NhamColors.elev, letterSpacing: -0.2),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
