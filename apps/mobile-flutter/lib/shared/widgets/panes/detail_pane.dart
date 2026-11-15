import 'package:flutter/material.dart';
import '../../../shell/window/window_layout.dart';

/// Marks a routed page whose parent list is visible beside it.
class DetailPane extends InheritedWidget {
  const DetailPane({super.key, required super.child, required this.layout});
  final WindowLayout layout;
  bool get nearLeft => layout.controlEdge == ControlEdge.left;

  static WindowLayout? layoutOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<DetailPane>()?.layout;

  static bool nearLeftOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<DetailPane>()?.nearLeft ??
      false;

  static bool of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<DetailPane>() != null;

  @override
  bool updateShouldNotify(DetailPane oldWidget) => layout != oldWidget.layout;
}
