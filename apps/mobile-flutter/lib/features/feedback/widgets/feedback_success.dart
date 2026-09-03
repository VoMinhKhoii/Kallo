import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';

/// What replaces the form once the feedback is in: the acknowledgement, plus
/// the two ways out.
///
/// This screen's title IS its content — the one editorial line the surface
/// exists to say — so unlike the form it keeps a headline in the body. The
/// header bar above it still carries the page name.
class FeedbackSuccess extends StatelessWidget {
  const FeedbackSuccess({
    super.key,
    required this.onDone,
    required this.onSendAnother,
  });

  final VoidCallback onDone;
  final VoidCallback onSendAnother;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(LucideIcons.circleCheck300, size: 40, color: kInk),
            const SizedBox(height: KalloSpacing.sp4),
            Text(
              tr('settings.feedback.successTitle'),
              textAlign: TextAlign.center,
              style: dashHeadline(),
            ),
            const SizedBox(height: KalloSpacing.sp2),
            Text(
              tr('settings.feedback.successBody'),
              textAlign: TextAlign.center,
              style: dashBody(color: kInkMuted),
            ),
            const SizedBox(height: KalloSpacing.sp5),
            // A full KalloButton here against the form's QuietActionButton:
            // two tiers by design. "Done" is this surface's single primary
            // action; the form's submit sits in a row of fields and takes the
            // quiet confirm instead.
            KalloButton(title: tr('settings.feedback.done'), onPressed: onDone),
            const SizedBox(height: KalloSpacing.sp2),
            KalloButton(
              title: tr('settings.feedback.sendAnother'),
              variant: KalloButtonVariant.ghost,
              onPressed: onSendAnother,
            ),
          ],
        ),
      ),
    );
  }
}
