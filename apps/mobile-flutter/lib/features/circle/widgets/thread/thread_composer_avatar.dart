import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../shared/widgets/feedback/skeleton.dart';
import '../../data/circle_providers.dart';

/// The viewer's own face at the head of the thread composer.
///
/// It is the reply rows' disc, at the reply rows' size and on their rail, so
/// the field reads as the next reply in the conversation rather than as a bar
/// bolted under it — the anatomy every comment thread the user pointed at uses
/// (Facebook, Threads).
///
/// Its own widget because it WATCHES: the profile is a fetched provider, and
/// rebuilding the composer on its arrival would rebuild the field, its
/// decoration and the draft's send affordance with it.
class ThreadComposerAvatar extends ConsumerWidget {
  const ThreadComposerAvatar({super.key});

  /// The reply rows' disc (`widgets/replies/reply_row.dart`), not the post's
  /// 32: what is being written here is a reply.
  static const double size = 28;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref
        .watch(myCircleProfileProvider)
        .when(
          data: (profile) => ProfileAvatarDisc(profile: profile, size: size),
          loading: () => const SkeletonPulse(child: SkeletonCircle(size: size)),
          // A static disc, NOT a pulse: a pulse says "still coming", and this
          // one is not. The slot keeps the dock's shape and the field beside
          // it still works — a face is the one part of a composer that can be
          // missing without costing the user anything.
          error: (_, _) => const SkeletonCircle(size: size),
        );
  }
}
