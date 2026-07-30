import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../models/circle.dart';
import '../../../shared/widgets/profile_avatar.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';

class FriendPickRow extends StatelessWidget {
  const FriendPickRow({
    required this.profile,
    required this.selected,
    required this.onTap,
    super.key,
  });

  final CircleProfile profile;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: profile.label,
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
              ProfileAvatarDisc(profile: profile, size: 32),
              const SizedBox(width: NhamSpacing.sp3),
              Expanded(
                child: Text(
                  profile.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: NhamTextStyles.sansRegular(
                    fontSize: NhamFontSize.sm,
                  ).copyWith(color: NhamColors.text),
                ),
              ),
              if (selected)
                const Icon(LucideIcons.check300, size: 16, color: NhamColors.btn),
            ],
          ),
        ),
      ),
    );
  }
}
