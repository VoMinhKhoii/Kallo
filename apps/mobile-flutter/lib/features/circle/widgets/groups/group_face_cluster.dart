import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_typography.dart';

/// A group as overlapping member faces, the way iOS draws one: each disc
/// carries a ring in the surface colour behind it, so the overlap reads as a
/// cut rather than one blob.
///
/// At most [max] slots. When the group is bigger than that ([total] past
/// [max]), the last slot becomes a "+N" disc, so the row never claims fewer
/// people than there are. Used by the group sheet's header (56pt) and under
/// the open Circle tab (26pt, sized to the tab's name).
class GroupFaceCluster extends StatelessWidget {
  const GroupFaceCluster({
    required this.members,
    required this.size,
    required this.ringColor,
    this.max = 3,
    this.total,
    this.step,
    super.key,
  });

  final List<CircleProfile> members;

  /// Diameter of one face, ring included.
  final double size;

  /// The surface the cluster sits on — the ring is drawn in it.
  final Color ringColor;

  /// Slots to draw, the "+N" disc included.
  final int max;

  /// How many people the group has; defaults to [members]' length.
  final int? total;

  /// Distance between one face's left edge and the next; 70% of [size].
  final double? step;

  /// Slots for faces of [size] and [step] that fit in [width] (+4pt of give),
  /// clamped to [min]–[maxSlots] — how the Circle tab sizes its faces to its
  /// name.
  static int slotsFor(
    double width, {
    required double size,
    required double step,
    int min = 2,
    int maxSlots = 5,
  }) => (((width + 4 - size) / step).floor() + 1).clamp(min, maxSlots);

  @override
  Widget build(BuildContext context) {
    final count = total ?? members.length;
    final overflow = count > max;
    final faces = members.take(overflow ? max - 1 : max).toList();
    final slots = faces.length + (overflow ? 1 : 0);
    if (slots == 0) return SizedBox.square(dimension: size);
    final ring = (size / 16).clamp(2.0, 3.0);
    final gap = step ?? size * 0.7;
    Widget disc(Widget child) => Container(
      width: size,
      height: size,
      padding: EdgeInsets.all(ring),
      decoration: BoxDecoration(color: ringColor, shape: BoxShape.circle),
      child: child,
    );
    return ExcludeSemantics(
      child: SizedBox(
        width: size + gap * (slots - 1),
        height: size,
        child: Stack(
          children: [
            for (var i = 0; i < faces.length; i++)
              Positioned(
                left: gap * i,
                top: 0,
                child: disc(
                  ProfileAvatarDisc(profile: faces[i], size: size - ring * 2),
                ),
              ),
            if (overflow)
              Positioned(
                left: gap * faces.length,
                top: 0,
                child: disc(
                  Container(
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(
                      color: kTrack,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      '+${count - faces.length}',
                      maxLines: 1,
                      // Sized to the disc, not the type ramp: "+12" has to
                      // fit a 22pt circle under the tab.
                      textScaler: TextScaler.noScaling,
                      style: TextStyle(
                        fontFamily: KalloTextStyles.sansFamily,
                        fontSize: size * 0.36,
                        height: 1,
                        color: kInk,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
