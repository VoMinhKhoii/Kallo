import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../logic/logging_spacing.dart';

/// A 28x28 (w-7 h-7) stepper button inside the shared logging tap target:
/// rounded-md,
/// border/60, white fill. Pressed → bg-nham-hover (the web hover:bg-nham-hover
/// touch affordance). Shared by the pending-meal entry and the saved-meal amount
/// editor so the ±10g stepper looks and feels identical in both.
class MealStepperButton extends StatefulWidget {
  const MealStepperButton({
    super.key,
    required this.icon,
    this.onTap,
    this.disabled = false,
  });

  final IconData icon;
  final VoidCallback? onTap;
  final bool disabled;

  @override
  State<MealStepperButton> createState() => _MealStepperButtonState();
}

class _MealStepperButtonState extends State<MealStepperButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final tappable = widget.onTap != null;
    return GestureDetector(
      onTapDown: tappable ? (_) => setState(() => _pressed = true) : null,
      onTapUp: tappable ? (_) => setState(() => _pressed = false) : null,
      onTapCancel: tappable ? () => setState(() => _pressed = false) : null,
      onTap: widget.onTap,
      // The shared logging hit target around the 28pt visual stepper (kept
      // under 44 so two steppers + the count value still fit a narrow row
      // without overflow).
      child: SizedBox(
        width: LoggingIcons.hit,
        height: LoggingIcons.hit,
        child: Center(
          child: Opacity(
            opacity: widget.disabled ? 0.4 : 1, // opacity-40
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150), // transition-colors
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: _pressed ? NhamColors.hover : NhamColors.elev,
                borderRadius: BorderRadius.circular(NhamRadii.md),
                border: Border.all(color: NhamColors.borderSoft),
              ),
              child: Icon(
                widget.icon,
                size: LoggingIcons.size,
                color: NhamColors.text,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
