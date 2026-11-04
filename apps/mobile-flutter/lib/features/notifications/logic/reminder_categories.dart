import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/env/env.dart';
import '../../../services/push/push_service.dart';

const _t = 'notifications.reminderActions';

/// Registers the meal-reminder notification categories with button titles in
/// the app's language (docs/NOTIFICATIONS.md → Phase 5, "Meal reminder
/// buttons"). iOS draws a notification's buttons from categories the app
/// registers, never from the push, so this runs on launch and again whenever
/// the language changes.
///
/// It sits in `MaterialApp`'s builder, BELOW the app's localizations: above
/// them easy_localization has not loaded its strings yet, `tr()` returns the
/// bare key, and the lock screen showed `notifications.reminderActions.logMeal`
/// as a button title. A title that still comes back as its key is never
/// registered; the next build tries again.
class ReminderCategories extends ConsumerStatefulWidget {
  const ReminderCategories({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<ReminderCategories> createState() => _ReminderCategoriesState();
}

class _ReminderCategoriesState extends ConsumerState<ReminderCategories> {
  /// The language the buttons were last registered in.
  String? _registeredLocale;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final locale = Localizations.localeOf(context).toString();
    if (locale == _registeredLocale) return;
    final titles = {
      for (final key in const [
        'addToYesterday',
        'thatWasAll',
        'logMeal',
        'logMore',
        'doneForToday',
      ])
        key: '$_t.$key'.tr(),
    };
    if (titles.entries.any((e) => e.value == '$_t.${e.key}')) return;
    _registeredLocale = locale;
    unawaited(
      ref
          .read(pushServiceProvider)
          .setReminderCategories(titles: titles, apiBase: Env.apiBaseUrl),
    );
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
