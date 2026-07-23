import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';

class MealActionIconButton extends StatelessWidget {
  const MealActionIconButton({
    super.key,
    required this.icon,
    required this.label,
    this.onTap,
    this.active = false,
    this.danger = false,
    this.pending = false,
    this.toggled,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool active;
  final bool danger;
  final bool pending;

  /// Screen-reader toggle state for on/off actions (the circle-share toggle);
  /// null for plain one-shot actions.
  final bool? toggled;

  @override
  Widget build(BuildContext context) {
    final foreground =
        danger
            ? NhamColors.danger
            : active
            ? NhamColors.accentDark
            : NhamColors.text;
    final enabled = onTap != null && !pending;

    return Tooltip(
      message: label,
      child: Semantics(
        button: true,
        enabled: enabled,
        toggled: toggled,
        label: label,
        child: Material(
          color: active ? NhamColors.accent10 : Colors.transparent,
          borderRadius: BorderRadius.circular(NhamRadii.md),
          child: InkResponse(
            onTap:
                enabled
                    ? () {
                      HapticFeedback.selectionClick();
                      onTap!();
                    }
                    : null,
            radius: 20,
            containedInkWell: true,
            highlightShape: BoxShape.rectangle,
            borderRadius: BorderRadius.circular(NhamRadii.md),
            child: SizedBox.square(
              dimension: 40,
              child: Center(
                child:
                    pending
                        ? SizedBox.square(
                          dimension: 13,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: foreground,
                          ),
                        )
                        : Icon(icon, size: 16, color: foreground),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
