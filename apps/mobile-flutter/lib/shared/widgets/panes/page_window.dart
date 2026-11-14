import 'package:flutter/widgets.dart';
import '../../../shell/window/window_layout.dart';

/// SafeArea consumes side insets; panes still need the original fold geometry.
class PageWindow extends InheritedWidget {
  const PageWindow({super.key, required this.layout, required super.child});
  final WindowLayout layout;

  static WindowLayout of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<PageWindow>()?.layout ??
      WindowLayout.of(context);

  @override
  bool updateShouldNotify(PageWindow oldWidget) => oldWidget.layout != layout;
}
