import 'package:flutter/widgets.dart';

import '../../../../theme/kallo_theme.dart';

/// The scrolling list every "Edit circle" page shares — friends, groups,
/// blocked: the app's 12 side inset, 8 under the header, and room at the foot
/// for the home indicator (these pages are pushed, with no pill nav).
class ManageList extends StatelessWidget {
  const ManageList({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => ListView(
    padding: EdgeInsets.fromLTRB(
      KalloSpacing.sp3,
      KalloSpacing.sp2,
      KalloSpacing.sp3,
      KalloSpacing.sp8 + MediaQuery.viewPaddingOf(context).bottom,
    ),
    children: children,
  );
}
