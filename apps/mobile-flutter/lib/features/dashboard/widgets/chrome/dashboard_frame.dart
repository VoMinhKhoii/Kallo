import 'package:flutter/widgets.dart';
import '../../../../shared/widgets/panes/page_window.dart';
import '../../../../shared/widgets/surface/scroll_separator.dart';

/// Split scrolls draw their own hairlines, leaving the fold strip empty.
class DashboardFrame extends StatelessWidget {
  const DashboardFrame({super.key, required this.header, required this.child});
  final Widget header;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        header,
        Expanded(
          child: ScrollSeparator(
            header: const SizedBox.shrink(),
            showHairline: !PageWindow.of(context).twoPane,
            child: child,
          ),
        ),
      ],
    );
  }
}
