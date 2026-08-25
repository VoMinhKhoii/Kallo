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
/// `SheetPrimaryButton` so the app has ONE press language.
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
    // Darken rather than lighten on press: both fills are darker than the card
    // they sit on, so a lighter press would read as the button lifting away.
    final Color held =
        widget.destructive
            ? Color.alphaBlend(const Color(0x1F000000), KalloColors.danger)
            : KalloColors.btnHover;

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
            constraints: const BoxConstraints(minHeight: 44),
            padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp3),
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
        child: Container(
          alignment: Alignment.center,
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp3),
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
