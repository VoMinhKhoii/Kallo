import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import '../../../../shared/widgets/brand/kallo_wordmark.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../shared/widgets/typography/meta_action.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// The decision sits level with the opening illustration beside it, centred
/// on the same height rather than dropped into the bottom corner.
///
/// The wordmark stands over the title here, as it stands over the preview on
/// a phone: the preview beside the fold is the device alone, so this column
/// is the one that says the name.
class StartTask extends StatelessWidget {
  const StartTask({super.key});

  /// The mark `/start` wears in one column too, so a fold does not resize it.
  static const double wordmarkHeight = 34;

  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 12),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Center(child: KalloWordmark(height: wordmarkHeight)),
            const SizedBox(height: KalloSpacing.sp4),
            Text(
              context.tr('onboarding.start.title'),
              textAlign: TextAlign.center,
              style: kPageTitle(),
            ),
            const SizedBox(height: 24),
            KalloButton(
              title: context.tr('onboarding.start.cta'),
              variant: KalloButtonVariant.cta,
              onPressed: () => context.push('/onboarding'),
            ),
            const SizedBox(height: 12),
            MetaAction(
              label: context.tr('onboarding.start.haveAccount'),
              onTap: () => context.push('/sign-in'),
            ),
          ],
        ),
      ),
    ),
  );
}
