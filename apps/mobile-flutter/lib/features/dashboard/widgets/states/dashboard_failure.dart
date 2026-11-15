import 'package:flutter/widgets.dart';
import '../../../../shell/window/window_layout.dart';
import '../../../../shared/widgets/panes/two_pane_scaffold.dart';

/// A failed bundle has one retry target, in the same pane as the day card.
class DashboardFailure extends StatelessWidget {
  const DashboardFailure({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) =>
      WindowLayout.of(context).twoPane
          ? TwoPaneScaffold(
            header: const SizedBox.shrink(),
            far: child,
            near: const SizedBox.shrink(),
          )
          : child;
}
