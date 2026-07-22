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
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool active;
  final bool danger;
  final bool pending;

  @override
  Widget build(BuildContext context) {
    final foreground = danger
        ? NhamColors.danger
        : active
        ? NhamColors.accentDark
        : NhamColors.textMuted;
    final enabled = onTap != null && !pending;

    return Tooltip(
      message: label,
      child: Semantics(
        button: true,
        enabled: enabled,
        label: label,
        child: Material(
          color: active ? NhamColors.accent10 : Colors.transparent,
          borderRadius: BorderRadius.circular(NhamRadii.md),
          child: InkResponse(
            onTap: enabled
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
                child: pending
                    ? SizedBox.square(
                        dimension: 13,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: foreground,
                        ),
                      )
                    : Icon(icon, size: 18, color: foreground),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
