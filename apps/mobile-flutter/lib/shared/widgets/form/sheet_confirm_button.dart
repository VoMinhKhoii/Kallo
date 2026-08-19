import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../../theme/kallo_typography.dart';

/// A sheet footer's commit action: an umber pill that hugs its label rather
/// than filling the row, and swaps in an inline spinner while the write is in
/// flight. Sits beside a quiet Back link, which is why it is not the
/// full-width `SheetPrimaryButton`.
class SheetConfirmButton extends StatefulWidget {
  const SheetConfirmButton({
    super.key,
    required this.label,
    required this.saving,
    required this.onTap,
  });

  final String label;

  /// While true the button shows a spinner and refuses taps.
  final bool saving;
  final VoidCallback onTap;

  @override
  State<SheetConfirmButton> createState() => _SheetConfirmButtonState();
}

class _SheetConfirmButtonState extends State<SheetConfirmButton> {
  bool _pressed = false;

  void _onTap() {
    HapticFeedback.lightImpact();
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    final enabled = !widget.saving;
    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.label,
      child: GestureDetector(
        onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
        onTapUp: enabled ? (_) => setState(() => _pressed = false) : null,
        onTapCancel: enabled ? () => setState(() => _pressed = false) : null,
        onTap: enabled ? _onTap : null,
        child: AnimatedScale(
          scale: _pressed ? 0.96 : 1,
          duration: const Duration(milliseconds: 150),
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: KalloSpacing.sp5,
              vertical: KalloSpacing.sp3,
            ),
            decoration: BoxDecoration(
              color: _pressed ? KalloColors.btnHover : KalloColors.btn,
              borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
            ),
            child:
                widget.saving
                    ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                    : Text(
                      widget.label,
                      style: KalloTextStyles.sansSemiBold(
                        fontSize: KalloFontSize.sm,
                      ).copyWith(color: Colors.white),
                    ),
          ),
        ),
      ),
    );
  }
}
