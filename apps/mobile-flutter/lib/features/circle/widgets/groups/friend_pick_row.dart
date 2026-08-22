import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../theme/kallo_typography.dart';

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
            horizontal: KalloSpacing.sp3,
            vertical: KalloSpacing.sp2_5,
          ),
          decoration: BoxDecoration(
            color: selected ? KalloColors.accent10 : Colors.transparent,
            borderRadius: BorderRadius.circular(KalloRadii.containerLg),
          ),
          child: Row(
            children: [
              ProfileAvatarDisc(profile: profile, size: 32),
              const SizedBox(width: KalloSpacing.sp3),
              Expanded(
                child: Text(
                  profile.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: KalloTextStyles.sansRegular(
                    fontSize: KalloFontSize.sm,
                  ).copyWith(color: KalloColors.text),
                ),
              ),
              if (selected)
                const Icon(LucideIcons.check300, size: 16, color: KalloColors.btn),
            ],
          ),
        ),
      ),
    );
  }
}
