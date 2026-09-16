import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../portion/portion_seats.dart' show kSeatColors;

/// The avatar with a status badge, so the KIND of notification is readable
/// before any text is — and stays readable once the row goes quiet.
class InviteAvatarWithBadge extends StatelessWidget {
  const InviteAvatarWithBadge({
    super.key,required this.profile});

  final CircleProfile profile;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 42,
      height: 42,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          ProfileAvatarDisc(profile: profile, size: 42),
          Positioned(
            right: -2,
            bottom: -2,
            child: Container(
              width: 18,
              height: 18,
              decoration: BoxDecoration(
                color: kSeatColors[1],
                shape: BoxShape.circle,
                border: Border.all(color: KalloColors.elev, width: 2),
              ),
              child: const Icon(
                LucideIcons.check300,
                size: 9,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class InviteOverflowButton extends StatelessWidget {
  const InviteOverflowButton({
    super.key,required this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tr('common.more'),
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: const SizedBox(
          width: KalloIcons.hit,
          height: KalloIcons.hit,
          child: Icon(
            LucideIcons.ellipsis300,
            size: KalloIcons.size,
            color: KalloColors.textMuted,
          ),
        ),
      ),
    );
  }
}

class InviteOverflowRow extends StatelessWidget {
  const InviteOverflowRow({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: KalloIcons.hit + 8),
        child: Row(
          children: [
            Icon(icon, size: KalloIcons.size, color: KalloColors.textMuted),
            const SizedBox(width: KalloSpacing.sp3),
            Text(label, style: dashBody()),
          ],
        ),
      ),
    );
  }
}
