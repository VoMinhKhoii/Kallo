import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/form/kallo_switch.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../data/sharing_providers.dart';
import '../../../../shared/widgets/list/list_row.dart';

class AutoShareToCircleToggle extends ConsumerStatefulWidget {
  const AutoShareToCircleToggle({super.key, required this.value});

  final bool value;

  @override
  ConsumerState<AutoShareToCircleToggle> createState() =>
      _AutoShareToCircleToggleState();
}

class _AutoShareToCircleToggleState
    extends ConsumerState<AutoShareToCircleToggle> {
  late bool _enabled = widget.value;
  bool _pending = false;

  @override
  void didUpdateWidget(covariant AutoShareToCircleToggle oldWidget) {
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
      final persisted = await setAutoShareToCircle(ref, enabled);
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
        tr('settings.sharing.error'),
        variant: TopToastVariant.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    // No subline: the label says what the toggle does, and the hint it used to
    // carry was prose in a single-line ellipsised slot — it read as a truncated
    // fragment rather than an explanation.
    return ListRow(
      icon: LucideIcons.users300,
      label: tr('settings.sharing.autoShareLabel'),
      // The static row provides no toggle semantics of its own — name the
      // switch so screen readers don't announce a bare on/off control.
      trailing: KalloSwitch(
        value: _enabled,
        onChanged: _pending ? null : _toggle,
        semanticLabel: tr('settings.sharing.autoShareLabel'),
      ),
    );
  }
}
