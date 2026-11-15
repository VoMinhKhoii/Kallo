import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../window/window_layout.dart';
import 'pill_nav_capsule.dart';
import 'pill_nav_veil.dart';

/// The [PillNavCapsule] stood up in a control column: a 56pt vertical capsule
/// with a 44pt Add disc, centred on the column.
///
/// It slides away toward its screen edge while the keyboard is up. Unlike the
/// bottom bar it stays visible while scrolling.
class PillNavColumn extends StatelessWidget {
  const PillNavColumn({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    final layout = WindowLayout.of(context);
    final keyboardUp = MediaQuery.viewInsetsOf(context).bottom > 0;
    return Padding(
      padding: EdgeInsets.only(
        bottom: layout.compactHeight ? 0 : layout.viewPadding.bottom + 8,
      ),
      child: Transform.translate(
        offset: Offset(
          layout.controlEdge == ControlEdge.right
              ? 36 - layout.columnWidth / 2
              : layout.columnWidth / 2 - 36,
          0,
        ),
        child: Align(
          alignment:
              layout.compactHeight ? Alignment.center : Alignment.bottomCenter,
          child: PillNavVeil(
            hidden: keyboardUp,
            direction:
                layout.nearLeft ? const Offset(-1, 0) : const Offset(1, 0),
            child: PillNavCapsule(
              navigationShell: navigationShell,
              axis: Axis.vertical,
            ),
          ),
        ),
      ),
    );
  }
}
