import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/form/kallo_switch.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../data/reminder_providers.dart';
import '../../../../shared/widgets/list/list_row.dart';

/// The meal-reminder switch (docs/NOTIFICATIONS.md → "Reminders"). The same
/// optimistic shape as [AutoShareToCircleToggle]: flips at once, settles on
/// what the server stored, and rolls back with a toast when the save fails.
class MealRemindersToggle extends ConsumerStatefulWidget {
  const MealRemindersToggle({super.key, required this.value});

  final bool value;

  @override
  ConsumerState<MealRemindersToggle> createState() =>
      _MealRemindersToggleState();
}

class _MealRemindersToggleState extends ConsumerState<MealRemindersToggle> {
  late bool _enabled = widget.value;
  bool _pending = false;

  @override
  void didUpdateWidget(covariant MealRemindersToggle oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_pending && widget.value != oldWidget.value) {
      _enabled = widget.value;
    }
  }

  Future<void> _toggle(bool enabled) async {
    if (_pending) return;
    setState(() {
      _enabled = enabled;
      _pending = true;
    });
    try {
      final persisted = await setMealReminders(ref, enabled);
      if (!mounted) return;
      setState(() {
        _enabled = persisted;
        _pending = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _enabled = !enabled;
        _pending = false;
      });
      showTopToast(
        context,
        tr('settings.reminders.error'),
        variant: TopToastVariant.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    // No subline, like the sharing row: a one-line ellipsised slot cannot hold
    // the explanation, which the web row carries instead.
    return ListRow(
      icon: LucideIcons.bell300,
      label: tr('settings.reminders.label'),
      // The static row provides no toggle semantics of its own — name the
      // switch so screen readers don't announce a bare on/off control.
      trailing: KalloSwitch(
        value: _enabled,
        onChanged: _pending ? null : _toggle,
        semanticLabel: tr('settings.reminders.label'),
      ),
    );
  }
}
