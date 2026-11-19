import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/form/kallo_switch.dart';
import '../../../../shared/widgets/list/list_row.dart';
import '../../../../shared/widgets/toast/top_toast.dart';

/// One on/off profile preference as a Settings row (Circle auto-share, meal
/// reminders): flips at once, settles on what the server stored, and rolls
/// back with [errorKey]'s toast when [save] fails.
///
/// No subline: the label says what the switch does, and the one-line
/// ellipsised slot read prose as a truncated fragment.
class ProfileSwitchRow extends StatefulWidget {
  const ProfileSwitchRow({
    super.key,
    required this.value,
    required this.icon,
    required this.labelKey,
    required this.errorKey,
    required this.save,
  });

  final bool value;
  final IconData icon;
  final String labelKey;
  final String errorKey;

  /// Saves the new value and returns the one the server stored.
  final Future<bool> Function(BuildContext context, bool enabled) save;

  @override
  State<ProfileSwitchRow> createState() => _ProfileSwitchRowState();
}

class _ProfileSwitchRowState extends State<ProfileSwitchRow> {
  late bool _enabled = widget.value;
  bool _pending = false;

  @override
  void didUpdateWidget(covariant ProfileSwitchRow oldWidget) {
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
      final persisted = await widget.save(context, enabled);
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
        tr(widget.errorKey),
        variant: TopToastVariant.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListRow(
      icon: widget.icon,
      label: tr(widget.labelKey),
      // The static row provides no toggle semantics of its own — name the
      // switch so screen readers don't announce a bare on/off control.
      trailing: KalloSwitch(
        value: _enabled,
        onChanged: _pending ? null : _toggle,
        semanticLabel: tr(widget.labelKey),
      ),
    );
  }
}
