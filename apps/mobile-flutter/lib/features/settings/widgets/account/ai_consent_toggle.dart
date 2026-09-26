import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/form/kallo_switch.dart';
import '../../../../shared/widgets/list/list_row.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../privacy/data/ai_consent_providers.dart';

/// "AI meal analysis" — where the consent the one-time sheet recorded is
/// withdrawn (or given without waiting to be asked). App Store 5.1.2(i).
/// Turning it off makes every AI entry point ask again before sending.
class AiConsentToggle extends ConsumerStatefulWidget {
  const AiConsentToggle({super.key});

  @override
  ConsumerState<AiConsentToggle> createState() => _AiConsentToggleState();
}

class _AiConsentToggleState extends ConsumerState<AiConsentToggle> {
  /// The value shown while a write is in flight; null otherwise.
  bool? _optimistic;

  Future<void> _toggle(bool consented) async {
    if (_optimistic != null) return;
    setState(() => _optimistic = consented);
    try {
      await ref.read(aiConsentRecordProvider.notifier).record(consented);
    } catch (_) {
      if (mounted) {
        showTopToast(
          context,
          tr('settings.aiConsent.error'),
          variant: TopToastVariant.error,
        );
      }
    } finally {
      if (mounted) setState(() => _optimistic = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool onRecord = ref.watch(aiConsentProvider);
    final consented = _optimistic ?? onRecord;
    return ListRow(
      icon: LucideIcons.sparkles300,
      label: tr('settings.aiConsent.label'),
      subline: tr('settings.aiConsent.subline'),
      trailing: KalloSwitch(
        value: consented,
        onChanged: _optimistic != null ? null : _toggle,
        semanticLabel: tr('settings.aiConsent.label'),
      ),
    );
  }
}
