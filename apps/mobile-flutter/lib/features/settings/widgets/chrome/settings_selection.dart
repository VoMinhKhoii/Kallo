import 'package:flutter/widgets.dart';

/// The list observes the nested stack without owning the page's draft.
class SettingsSelection extends InheritedNotifier<ValueNotifier<Type?>> {
  const SettingsSelection({
    super.key,
    required super.notifier,
    required super.child,
  });

  static Type? of(BuildContext context) =>
      context
          .dependOnInheritedWidgetOfExactType<SettingsSelection>()
          ?.notifier
          ?.value;
}
