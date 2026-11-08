import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../models/social/circle.dart';
import '../../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../portion/portion_seats.dart';

/// The inverted water drop carrying a person's face, ringed in their seat
/// colour, with the × disc drawn on it when they can be removed. Paint only:
/// the tap lives on `PortionPin`, which has the room for a finger.
class PortionDrop extends StatelessWidget {
  const PortionDrop({
    required this.seat,
    required this.profile,
    required this.initials,
    required this.showBadge,
    super.key,
  });

  final int seat;
  final CircleProfile? profile;
  final String initials;
  final bool showBadge;

  /// The drop, and the seat-coloured ring around it.
  static const double _drop = 36;
  static const double _ring = 2;
  static const double box = _drop + _ring * 2;

  /// The × disc, and how far it hangs off the drop's top-right corner.
  static const double badge = 18;
  static const double badgeOverhang = 6;

  /// Their photo when they have one, else their initials on the seat colour.
  /// The glyph goes down as [ProfileAvatarDisc.fallback] as well, so a photo
  /// that is still loading or never loads leaves THIS text showing rather than
  /// the disc's own — which would draw the first letter of their name where
  /// seat 0 needs a localised word.
  Widget _face() {
    final glyph = Text(
      initials,
      style: dashCaption(color: kSeatInk[seat % kSeatInk.length]),
    );
    final person = profile;
    if (person != null && (person.avatarUrl?.trim().isNotEmpty ?? false)) {
      return ProfileAvatarDisc(profile: person, size: 32, fallback: glyph);
    }
    return glyph;
  }

  @override
  Widget build(BuildContext context) {
    final color = kSeatColors[seat % kSeatColors.length];
    // The drop keeps its square box even where the run it labels is narrower
    // than it — a bare SizedBox would be squeezed by the Expanded above and
    // paint an oval. Overlapping a neighbour reads better than a distorted
    // face.
    return SizedBox(
      height: box,
      child: OverflowBox(
        minWidth: box,
        maxWidth: box,
        minHeight: box,
        maxHeight: box,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            // Two nested boxes, not a spread shadow: `spreadRadius` inflates
            // the rect without inflating the corner radii, so it would draw a
            // squircle around a circle. Nesting keeps the ring concentric and
            // makes the box arithmetic structural.
            Transform.rotate(
              angle: -0.785398, // -45°
              child: Container(
                width: box,
                height: box,
                padding: const EdgeInsets.all(_ring),
                decoration: BoxDecoration(
                  // A photo covers the drop, so the seat colour that binds
                  // this pin to its run is re-stated on the outside.
                  color: color,
                  borderRadius: _corners(box / 2),
                  boxShadow: const [KalloShadows.sm],
                ),
                child: Container(
                  decoration: BoxDecoration(
                    color: color,
                    border: Border.all(color: KalloColors.elev, width: 2),
                    borderRadius: _corners(_drop / 2),
                  ),
                  // No clipBehavior: ProfileAvatarDisc is already a ClipOval,
                  // and clipping here would cost a saveLayer.
                  child: Center(
                    child: Transform.rotate(angle: 0.785398, child: _face()),
                  ),
                ),
              ),
            ),
            if (showBadge)
              Positioned(
                top: -badgeOverhang,
                right: -badgeOverhang,
                child: Container(
                  width: badge,
                  height: badge,
                  decoration: BoxDecoration(
                    color: KalloColors.elev,
                    shape: BoxShape.circle,
                    border: Border.all(color: KalloColors.border),
                  ),
                  child: Icon(
                    LucideIcons.x300,
                    size: 11,
                    color: KalloColors.textSoft,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Three round corners and one square one, so the rotation points it down.
BorderRadius _corners(double r) => BorderRadius.only(
  topLeft: Radius.circular(r),
  topRight: Radius.circular(r),
  bottomRight: Radius.circular(r),
);
