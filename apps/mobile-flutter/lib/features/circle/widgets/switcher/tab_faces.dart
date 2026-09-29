import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_motion.dart';
import '../groups/group_face_cluster.dart';
import 'tab_layout.dart';

/// Who a Circle view holds: the people to draw, and how many there are.
typedef TabPeople = ({List<CircleProfile> faces, int total});

/// The faces under an open Circle tab's name, centred under it.
///
/// **Sized to the tab, not to the group.** As many faces as the tab's share
/// of the row holds ([TabGeometry.faceSlots]; at least 104pt, so even "All"
/// shows three and a "+N"), the last slot turning into "+N" when the group
/// is bigger. The tab's width never depends on its faces, so they can never
/// widen it.
///
/// Opening grows the row in (the name lifts with it) and fades the faces up
/// from a few points above; closing folds it away. The tab row's height is
/// fixed, so none of this moves the feed.
class TabFaces extends StatelessWidget {
  const TabFaces({required this.people, super.key});

  /// Null while the tab is closed, or before its people have loaded.
  final TabPeople? people;

  @override
  Widget build(BuildContext context) {
    final people = this.people;
    final show = people != null && people.faces.isNotEmpty;
    return AnimatedSize(
      duration: KalloMotion.emphasis,
      curve: KalloEase.decelerate,
      alignment: Alignment.topCenter,
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
                  padding: const EdgeInsets.only(top: TabGeometry.facesGap),
                  child: LayoutBuilder(
                    builder:
                        (_, constraints) => GroupFaceCluster(
                          members: people.faces,
                          total: people.total,
                          max: TabGeometry.faceSlots(constraints.maxWidth),
                          size: TabGeometry.faceSize,
                          step: TabGeometry.faceStep,
                          ringColor: kPage,
                        ),
                  ),
                ),
              )
              : const SizedBox(width: 0, height: 0),
    );
  }
}
