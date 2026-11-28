import 'package:flutter/widgets.dart';
import 'window_layout.dart';

/// Preserves window geometry when a pane consumes its local safe-area insets.
class WindowLayoutScope extends InheritedWidget {
  const WindowLayoutScope({
    super.key,
    required this.layout,
    required super.child,
  });
  final WindowLayout layout;

  @override
  bool updateShouldNotify(WindowLayoutScope oldWidget) =>
      layout != oldWidget.layout;
}
