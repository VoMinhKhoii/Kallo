import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/logic/legal_links.dart';
import '../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../shared/widgets/surface/kallo_button.dart';
import '../../../shared/widgets/toast/top_toast.dart';
import '../../../shared/widgets/typography/meta_action.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../data/ai_consent_providers.dart';

/// Opens the one-time AI-processing consent sheet (App Store 5.1.2(i)) and
/// resolves with the answer: true once consent is recorded on the server,
/// false for "Not now", the X, a drag-down or the barrier — nothing is sent.
Future<bool> showAiConsentSheet(BuildContext context) async {
  HapticFeedback.lightImpact(); // a decision is being asked for
  final agreed = await showNhamSheet<bool>(
    context,
    builder: (_) => const AiConsentSheet(),
  );
  return agreed ?? false;
}

/// Who receives what (Google Gemini on Vertex AI), that it is not used for
/// training, and where to read more — then Continue / Not now. Web
/// counterpart: `components/privacy/ai-consent-dialog.tsx`.
class AiConsentSheet extends ConsumerStatefulWidget {
  const AiConsentSheet({super.key});

  @override
  ConsumerState<AiConsentSheet> createState() => _AiConsentSheetState();
}

class _AiConsentSheetState extends ConsumerState<AiConsentSheet> {
  bool _saving = false;

  Future<void> _continue() async {
    setState(() => _saving = true);
    try {
      final stored = await ref
          .read(aiConsentRecordProvider.notifier)
          .record(true);
      if (mounted) Navigator.of(context).pop(stored);
    } catch (_) {
      if (!mounted) return;
      setState(() => _saving = false);
      showTopToast(
        context,
        tr('logging.aiConsent.error'),
        variant: TopToastVariant.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final muted = dashBody(color: kInkMuted);
    return PopScope(
      // Hold the sheet against a back gesture while the write is in flight.
      // A drag-down can still close it; the write lands regardless and is
      // recorded in [aiConsentRecordProvider], so the next AI action simply
      // goes through without asking.
      canPop: !_saving,
      child: KalloSheetSurface(
        scrollable: true,
        padding: EdgeInsets.only(
          left: KalloSpacing.sp4,
          right: KalloSpacing.sp4,
          bottom: math.max(mq.viewPadding.bottom, KalloSpacing.sp4),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            KalloSheetHeader(
              title: tr('logging.aiConsent.title'),
              closeEnabled: !_saving,
              onClose: () => Navigator.of(context).pop(false),
            ),
            const SizedBox(height: KalloSpacing.sp2),
            Text(tr('logging.aiConsent.body'), style: dashBody()),
            const SizedBox(height: KalloSpacing.sp2),
            Text(tr('logging.aiConsent.training'), style: muted),
            Align(
              alignment: Alignment.centerLeft,
              child: MetaAction(
                label: tr('logging.aiConsent.privacyLink'),
                color: kInk,
                onTap:
                    () => openLegalPage(
                      context,
                      privacyUrlFor(context.locale.languageCode),
                    ),
              ),
            ),
            const SizedBox(height: KalloSpacing.sp3),
            KalloButton(
              title: tr('logging.aiConsent.continue'),
              loading: _saving,
              onPressed: _continue,
            ),
            const SizedBox(height: KalloSpacing.sp2),
            KalloButton(
              title: tr('logging.aiConsent.notNow'),
              variant: KalloButtonVariant.ghost,
              disabled: _saving,
              onPressed: () => Navigator.of(context).pop(false),
            ),
          ],
        ),
      ),
    );
  }
}
