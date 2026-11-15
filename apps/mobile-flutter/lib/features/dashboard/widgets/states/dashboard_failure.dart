import 'package:flutter/widgets.dart';
import '../../../../shared/widgets/panes/two_pane_scaffold.dart';

/// A failed bundle has one retry target, in the same pane as the day card.
class DashboardFailure extends StatelessWidget {
  const DashboardFailure({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) =>
      TwoPaneScaffold(single: child, far: child, near: const SizedBox.shrink());
}
