import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';
import '../groups/group_face_cluster.dart';

/// The faces under an open Circle tab's name.
///
/// **Sized to the name, not to the group.** As many faces as the name is
/// wide (2–5 slots of [_size] every [_step]), the last slot turning into "+N"
/// when the group is bigger — so the name and its faces read as one block
/// and the tab never widens when it opens. The width is MEASURED at the
/// viewer's text scale, so it holds in both languages and at 1.3x.
///
/// Opening grows the row in (the name lifts with it) and fades the faces up
/// from a few points above; closing folds it away.
/// Who a Circle view holds: the people to draw, and how many there are.
typedef TabPeople = ({List<CircleProfile> faces, int total});

class TabFaces extends StatelessWidget {
  const TabFaces({required this.label, required this.people, super.key});

  final String label;

  /// Null while the tab is closed, or before its people have loaded.
  final TabPeople? people;

  static const double _size = 26;
  static const double _step = 17;

  int _slots(BuildContext context) {
    final painter = TextPainter(
      text: TextSpan(text: label, style: dashBody()),
      textDirection: Directionality.of(context),
      textScaler: MediaQuery.textScalerOf(context),
      maxLines: 1,
    )..layout();
    final width = painter.width;
    painter.dispose();
    // Faces that fit under the name with 4pt of give, never fewer than two
    // (a face and the "+N") nor more than five.
    return (((width + 4 - _size) / _step).floor() + 1).clamp(2, 5);
  }

  @override
  Widget build(BuildContext context) {
    final people = this.people;
    final show = people != null && people.faces.isNotEmpty;
    return AnimatedSize(
      duration: KalloMotion.emphasis,
      curve: KalloEase.decelerate,
      alignment: Alignment.topLeft,
      child:
          show
              ? TweenAnimationBuilder<double>(
                key: const ValueKey('tab-faces'),
                tween: Tween(begin: 0, end: 1),
                duration: KalloMotion.emphasis,
                curve: KalloEase.decelerate,
                builder:
                    (_, t, child) => Opacity(
                      opacity: t,
                      child: Transform.translate(
                        offset: Offset(0, -6 * (1 - t)),
                        child: child,
                      ),
                    ),
                child: Padding(
                  padding: const EdgeInsets.only(top: KalloSpacing.sp1_5),
                  child: GroupFaceCluster(
                    members: people.faces,
                    total: people.total,
                    max: _slots(context),
                    size: _size,
                    step: _step,
                    ringColor: kPage,
                  ),
                ),
              )
              : const SizedBox(width: 0, height: 0),
    );
  }
}
