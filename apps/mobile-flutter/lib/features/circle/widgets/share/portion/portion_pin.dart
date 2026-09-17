import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../models/social/circle.dart';
import '../../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../portion/portion_seats.dart';

/// One person's marker: their kcal over an inverted water drop carrying their
/// face, pointing down at the run of cells that belongs to them.
///
/// Twin of `PortionPin` in `components/groups/share-meal/portion/pin.tsx`.
class PortionPin extends StatelessWidget {
  const PortionPin({
    required this.seat,
    required this.profile,
    required this.initials,
    required this.kcal,
    required this.onRemove,
    super.key,
  });

  /// Index into [kSeatColors] — the colour this person's cells are painted in.
  final int seat;

  final CircleProfile? profile;

  /// Drawn when there is no photo. For seat 0 this is the localised "You",
  /// never a name initial, which is why the caller supplies it.
  final String initials;

  final int? kcal;
  final VoidCallback? onRemove;

  /// The drop, and the seat-coloured ring around it.
  static const double _drop = 36;
  static const double _ring = 2;
  static const double _box = _drop + _ring * 2;

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
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        if (kcal != null)
          Text(
            '$kcal',
            style: dashMeta(color: kInk),
            maxLines: 1,
            overflow: TextOverflow.clip,
          ),
        const SizedBox(height: 6),
        // The drop keeps its square box even where the run it labels is
        // narrower than it — a bare SizedBox would be squeezed by the Expanded
        // above and paint an oval. Overlapping a neighbour reads better than a
        // distorted face.
        SizedBox(
          height: _box,
          child: OverflowBox(
            minWidth: _box,
            maxWidth: _box,
            minHeight: _box,
            maxHeight: _box,
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                // Two nested boxes, not a spread shadow: `spreadRadius`
                // inflates the rect without inflating the corner radii, so it
                // would draw a squircle around a circle. Nesting keeps the ring
                // concentric and makes the box arithmetic structural.
                Transform.rotate(
                  angle: -0.785398, // -45°
                  child: Container(
                    width: _box,
                    height: _box,
                    padding: const EdgeInsets.all(_ring),
                    decoration: BoxDecoration(
                      // A photo covers the drop, so the seat colour that binds
                      // this pin to its run is re-stated on the outside.
                      color: color,
                      borderRadius: _corners(_box / 2),
                      boxShadow: const [KalloShadows.sm],
                    ),
                    child: Container(
                      decoration: BoxDecoration(
                        color: color,
                        border: Border.all(color: KalloColors.elev, width: 2),
                        borderRadius: _corners(_drop / 2),
                      ),
                      // No clipBehavior: ProfileAvatarDisc is already a
                      // ClipOval, and clipping here would cost a saveLayer.
                      child: Center(
                        child: Transform.rotate(
                          angle: 0.785398,
                          child: _face(),
                        ),
                      ),
                    ),
                  ),
                ),
                if (onRemove != null)
                  Positioned(
                    top: -6,
                    right: -6,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () {
                        HapticFeedback.selectionClick();
                        onRemove!();
                      },
                      child: Container(
                        width: 18,
                        height: 18,
                        decoration: BoxDecoration(
                          color: KalloColors.elev,
                          shape: BoxShape.circle,
                          border: Border.all(color: KalloColors.border),
                        ),
                        child: const Icon(
                          LucideIcons.x300,
                          size: 11,
                          color: KalloColors.textSoft,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
      ],
    );
  }
}

/// Three round corners and one square one, so the rotation points it down.
BorderRadius _corners(double r) => BorderRadius.only(
  topLeft: Radius.circular(r),
  topRight: Radius.circular(r),
  bottomRight: Radius.circular(r),
);
