import 'package:flutter/widgets.dart';

import '../../../shell/window/window_layout.dart';

/// Keeps the existing 12pt page insets inside a centred 560pt reading measure.
/// The wrapper stays mounted on phones so resizing never replaces its child.
class PageColumn extends StatelessWidget {
  const PageColumn({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final layout = WindowLayout.of(context);
    return LayoutBuilder(
      builder:
          (context, constraints) => Padding(
            padding: EdgeInsets.symmetric(
              horizontal:
                  layout.twoPane
                      ? 0
                      : ((constraints.maxWidth - 584) / 2).clamp(
                        0,
                        double.infinity,
                      ),
            ),
            child: child,
          ),
    );
  }
}
