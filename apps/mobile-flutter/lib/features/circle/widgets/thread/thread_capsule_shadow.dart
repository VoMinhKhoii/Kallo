import 'package:flutter/widgets.dart';

import '../../../../shared/widgets/panes/detail_pane.dart';
import '../../../../shell/nav/over_shell/nav_column_shadow.dart';

/// Redraws, over a thread shown beside the feed, the part of the side
/// capsule's shadow that the thread covers ([NavColumnShadow]).
///
/// Beside the feed the thread is still a route above the tab shell, so its
/// surface is painted over the capsule's shadow where the shadow reaches into
/// the pane. Pushed over the whole window, the thread covers the capsule too
/// and draws nothing here.
class ThreadCapsuleShadow extends StatelessWidget {
  const ThreadCapsuleShadow({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) =>
      NavColumnShadow(show: DetailPane.of(context), child: child);
}
