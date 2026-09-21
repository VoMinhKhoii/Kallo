import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../theme/kallo_colors.dart';
import '../portion/portion_seats.dart' show kSeatColors;

/// The avatar with a status badge, so the KIND of notification is readable
/// before any text is — and stays readable once the row goes quiet.
class InviteAvatarWithBadge extends StatelessWidget {
  const InviteAvatarWithBadge({super.key, required this.profile});

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

/// A macro figure for the invite card's nutrition line, or the N/A dash when
/// the estimate never resolved.
String fmtInviteG(double? value) =>
    value == null ? tr('groups.invites.na') : '${value.round()}g';

/// The same, for the calorie figure that anchors the line's trailing edge.
String fmtInviteKcal(double? value) =>
    value == null ? tr('groups.invites.na') : '${value.round()} kcal';
