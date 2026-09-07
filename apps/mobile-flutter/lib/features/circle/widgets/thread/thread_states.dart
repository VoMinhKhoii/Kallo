import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/thread_providers.dart';
import '../states/circle_error.dart';
import '../states/circle_skeleton.dart';

/// The thread page's three not-ready surfaces — loading, failed, gone — in
/// one padded scroll view. The screen keeps orchestration (focus, scroll,
/// dock height) and hands presentation here, so the page-inset arithmetic is
/// written once instead of once per state.
class ThreadStates extends StatelessWidget {
  const ThreadStates({required this.view, required this.onRetry, super.key});

  /// Never [ThreadReady] — that state is the body, not a placeholder.
  final ThreadView view;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    // No dock in these states, so the page owes the home indicator itself.
    final safeBottom = MediaQuery.paddingOf(context).bottom;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        KalloSpacing.sp3,
        KalloSpacing.sp3,
        KalloSpacing.sp3,
        KalloSpacing.sp3 + safeBottom,
      ),
      child: switch (view) {
        ThreadLoading() => const CircleWallSkeleton(),
        ThreadFailed() => CircleErrorCard(onRetry: onRetry),
        // Never auto-pop: a screen that closes itself under the user's thumb
        // reads as a crash. Say what happened and offer the way back.
        ThreadMissing() => KalloSurfaceState(
          area: SurfaceArea.circle,
          kind: SurfaceKind.empty,
          title: tr('groups.feed.threadGone'),
          subtitle: tr('groups.feed.threadGoneBody'),
          action: KalloButton(
            title: tr('common.back'),
            variant: KalloButtonVariant.cta,
            onPressed: () => Navigator.of(context).maybePop(),
          ),
        ),
        ThreadReady() => const SizedBox.shrink(),
      },
    );
  }
}
