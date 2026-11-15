import 'package:flutter/widgets.dart';
import '../../../shell/window/window_layout.dart';
import '../../../shell/window/window_layout_scope.dart';

/// SafeArea consumes side insets; panes still need the original fold geometry.
class PageWindow extends StatelessWidget {
  const PageWindow({super.key, required this.layout, required this.child});
  final WindowLayout layout;
  final Widget child;

  static WindowLayout of(BuildContext context) => WindowLayout.of(context);

  @override
  Widget build(BuildContext context) =>
      WindowLayoutScope(layout: layout, child: child);
}
