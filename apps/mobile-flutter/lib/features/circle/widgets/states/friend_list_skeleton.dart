/// Circle-feature friend-list loading skeletons.
///
/// Split out of the shared `skeleton.dart` (which stays generic primitives)
/// and built from them.
library;

import 'package:flutter/material.dart';

import '../../../../shared/widgets/feedback/skeleton.dart';

/// A friend-picker row placeholder — avatar disc + name bar, matching
/// `FriendPickRow`'s padding.
class FriendRowSkeleton extends StatelessWidget {
  const FriendRowSkeleton({super.key});

  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          children: [
            SkeletonCircle(size: 32),
            SizedBox(width: 12),
            Expanded(child: SkeletonBar(widthFactor: 0.55, height: 12)),
          ],
        ),
      );
}

/// A pulsing column of three friend-row placeholders under a [Semantics]
/// loading label. Shared by the circle friend-list loading states.
class FriendListSkeleton extends StatelessWidget {
  const FriendListSkeleton({this.semanticsLabel, super.key});

  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final list = SkeletonPulse(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [for (var i = 0; i < 3; i++) const FriendRowSkeleton()],
      ),
    );
    if (semanticsLabel == null) return list;
    return Semantics(label: semanticsLabel, child: list);
  }
}
