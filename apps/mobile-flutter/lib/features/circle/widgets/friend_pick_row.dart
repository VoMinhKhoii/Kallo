import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import 'circle_avatar.dart';

class FriendPickRow extends StatelessWidget {
  const FriendPickRow({
    required this.label,
    required this.initial,
    required this.selected,
    required this.onTap,
    super.key,
  });

  final String label;
  final String initial;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp3,
            vertical: NhamSpacing.sp2_5,
          ),
          decoration: BoxDecoration(
            color: selected ? NhamColors.accent10 : Colors.transparent,
            borderRadius: BorderRadius.circular(NhamRadii.containerLg),
          ),
          child: Row(
            children: [
              CircleInitialsAvatar(initial: initial, size: 32),
              const SizedBox(width: NhamSpacing.sp3),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: NhamTextStyles.sansRegular(
                    fontSize: NhamFontSize.sm,
                  ).copyWith(color: NhamColors.text),
                ),
              ),
              if (selected)
                const Icon(LucideIcons.check, size: 16, color: NhamColors.btn),
            ],
          ),
        ),
      ),
    );
  }
}
