import 'package:flutter/material.dart';

import '../../../../../models/social/circle.dart';
import '../../../../../shared/widgets/avatar/profile_avatar.dart';

/// Up to three overlapping member faces, the way iOS draws a group: each disc
/// carries a ring in the surface colour behind it so the overlap reads as a
/// cut, not as one blob.
class GroupFaceCluster extends StatelessWidget {
  const GroupFaceCluster({
    required this.members,
    required this.size,
    required this.ringColor,
    super.key,
  });

  final List<CircleProfile> members;

  /// Diameter of one face, ring included.
  final double size;

  /// The surface the cluster sits on — the ring is drawn in it.
  final Color ringColor;

  static const int _max = 3;

  @override
  Widget build(BuildContext context) {
    final faces = members.take(_max).toList();
    if (faces.isEmpty) return SizedBox.square(dimension: size);
    final ring = (size / 16).clamp(2.0, 3.0);
    // Each face tucks under the next by 30% of its width.
    final step = size * 0.7;
    return ExcludeSemantics(
      child: SizedBox(
        width: size + step * (faces.length - 1),
        height: size,
        child: Stack(
          children: [
            for (var i = 0; i < faces.length; i++)
              Positioned(
                left: step * i,
                top: 0,
                child: Container(
                  width: size,
                  height: size,
                  padding: EdgeInsets.all(ring),
                  decoration: BoxDecoration(
                    color: ringColor,
                    shape: BoxShape.circle,
                  ),
                  child: ProfileAvatarDisc(
                    profile: faces[i],
                    size: size - ring * 2,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
