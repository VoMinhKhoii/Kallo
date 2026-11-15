import 'package:flutter/material.dart';
import '../../../shell/window/window_layout.dart';

/// Marks a routed page whose parent list is visible beside it.
class DetailPane extends InheritedWidget {
  const DetailPane({super.key, required super.child});

  static bool nearLeftOf(BuildContext context) =>
      of(context) && WindowLayout.of(context).controlEdge == ControlEdge.left;

  static bool of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<DetailPane>() != null;

  @override
  bool updateShouldNotify(DetailPane oldWidget) => false;
}
