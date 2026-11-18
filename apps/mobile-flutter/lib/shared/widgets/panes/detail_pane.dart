import 'package:flutter/material.dart';

/// Marks a routed page whose parent list is visible beside it.
class DetailPane extends InheritedWidget {
  const DetailPane({super.key, required super.child});

  static bool of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<DetailPane>() != null;

  @override
  bool updateShouldNotify(DetailPane oldWidget) => false;
}
