import 'package:flutter/widgets.dart';

/// A group sheet second level held to the info page's size: [info] is laid
/// out beneath [child] but never painted, tapped or read out, and [child]
/// fills the box it leaves.
///
/// `SheetPageSwap` snaps to the taller of two pages and settles after, which
/// read as a jump each way between the info and a shorter second level. The
/// info page is laid out rather than measured on the way out, because the
/// long-press menu opens the sheet straight on a second level, with no info
/// page ever shown.
class HeldLevel extends StatelessWidget {
  const HeldLevel({required this.info, required this.child, super.key});

  final Widget info;
  final Widget child;

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      Visibility(
        visible: false,
        maintainState: true,
        maintainAnimation: true,
        maintainSize: true,
        child: info,
      ),
      Positioned.fill(child: child),
    ],
  );
}
