import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_motion.dart';
import '../../../theme/kallo_theme.dart';

/// The confirm dialog's two buttons, STACKED rather than sat side by side.
///
/// Side-by-side is where the ambiguity lived: two short Vietnamese words of the
/// same size and weight, on one line, neither of which reads as the safe one —
/// and "huỷ" means both *cancel* and *destroy*, so "Huỷ | Xoá" gave the user two
/// words for the same thing. Stacking separates them by position as well as by
/// colour, which is what the web dialog already does on a phone
/// (`components/ui/alert-dialog.tsx`, `flex-col-reverse`: cancel first in the
/// DOM, affirmative first on screen). This is that layout in Flutter.
class KalloConfirmActions extends StatelessWidget {
  const KalloConfirmActions({
    super.key,
    required this.confirmLabel,
    required this.cancelLabel,
    required this.destructive,
    required this.onConfirm,
    required this.onCancel,
  });

  final String confirmLabel;
  final String cancelLabel;

  /// Paints the affirmative red. Reserved for what the palette reserves it for:
  /// "this destroys something", never "your numbers are off".
  final bool destructive;

  final VoidCallback onConfirm;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _ConfirmButton(
          label: confirmLabel,
          destructive: destructive,
          onTap: onConfirm,
        ),
        const SizedBox(height: KalloSpacing.sp2),
        _CancelButton(label: cancelLabel, onTap: onCancel),
      ],
    );
  }
}

/// The affirmative: a full-width filled pill, umber by default and [danger] red
/// when the action destroys something. Press behaviour copies
/// the retired `SheetPrimaryButton` so the app has ONE press language.
class _ConfirmButton extends StatefulWidget {
  const _ConfirmButton({
    required this.label,
    required this.destructive,
    required this.onTap,
  });

  final String label;
  final bool destructive;
  final VoidCallback onTap;

  @override
  State<_ConfirmButton> createState() => _ConfirmButtonState();
}

class _ConfirmButtonState extends State<_ConfirmButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final Color resting =
        widget.destructive ? KalloColors.danger : KalloColors.btn;
    // Both pressed fills are tokens, the way every other pill in the app names
    // its own: btn → btnHover, danger → dangerHover.
    final Color held =
        widget.destructive ? KalloColors.dangerHover : KalloColors.btnHover;

    return Semantics(
      button: true,
      label: widget.label,
      child: GestureDetector(
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: () {
          // The one moment worth a firmer tap than a selection click: past this
          // point something is gone.
          HapticFeedback.mediumImpact();
          widget.onTap();
        },
        child: AnimatedScale(
          scale: _pressed ? 0.97 : 1,
          duration: KalloMotion.press,
          curve: KalloEase.press,
          child: Container(
            alignment: Alignment.center,
            // Height comes from the padding alone, like every other button in
            // the app — 14 + 14 + a 14pt label's 18.2 line box is 46.2, so the
            // minHeight this used to carry was never the thing clearing the
            // 44pt tap floor. It was also the only one in the app.
            padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp3_5),
            decoration: BoxDecoration(
              color: _pressed ? held : resting,
              borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
            ),
            child: Text(
              widget.label,
              textAlign: TextAlign.center,
              style: dashBody(color: Colors.white, weight: FontWeight.w500),
            ),
          ),
        ),
      ),
    );
  }
}

/// The way out: no fill, no border, muted label. It presses with the WARM wash
/// rather than [KalloColors.pressWash] because it sits on the dialog's white
/// card, not on the canvas — warm for controls over a lighter surface.
class _CancelButton extends StatefulWidget {
  const _CancelButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  State<_CancelButton> createState() => _CancelButtonState();
}

class _CancelButtonState extends State<_CancelButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: widget.onTap,
        // Animated, not a bare Container: every other quiet button in the app
        // crossfades its wash rather than snapping it on (TerminalDiscardButton,
        // profile_form's ghost button).
        child: AnimatedContainer(
          duration: KalloMotion.press,
          curve: KalloEase.press,
          alignment: Alignment.center,
          // Matches the affirmative above it, so the stack is one height.
          padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp3_5),
          decoration: BoxDecoration(
            color: _pressed ? KalloColors.hover : Colors.transparent,
            borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
          ),
          child: Text(
            widget.label,
            textAlign: TextAlign.center,
            style: dashBody(color: kInkMuted, weight: FontWeight.w500),
          ),
        ),
      ),
    );
  }
}
