import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
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
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../data/ai_consent_providers.dart';

/// Opens the one-time AI-processing consent sheet (App Store 5.1.2(i)) and
/// resolves with the answer: true once consent is recorded on the server,
/// false for "Not now", the X or a tap on the barrier — nothing is sent.
///
/// A Cupertino route (`apps/mobile-flutter/AGENTS.md` §2), and the modal
/// POPUP rather than `CupertinoSheetRoute`: this is a two-button decision that
/// hugs its content, like an action sheet, and `CupertinoSheetRoute` has no
/// content-hugging mode — it would present the question as a near-full-height
/// page (`mobile.md`, the `SheetRoute` migration row). The route paints no
/// `Material`, so the content gets a transparent one for [KalloButton] and the
/// text theme; the barrier is the app's scrim, as the confirm alert's is.
Future<bool> showAiConsentSheet(BuildContext context) async {
  HapticFeedback.lightImpact(); // a decision is being asked for
  final agreed = await showCupertinoModalPopup<bool>(
    context: context,
    barrierColor: KalloColors.scrim,
    builder:
        (_) => const Material(
          type: MaterialType.transparency,
          child: AiConsentSheet(),
        ),
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
      // Hold the sheet — against the barrier and a back gesture alike — while
      // the write is in flight, so Continue always answers with what the
      // server stored.
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
