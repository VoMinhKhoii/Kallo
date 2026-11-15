import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../shared/widgets/typography/meta_action.dart';
import '../../../../theme/calm_tokens.dart';

/// The decision stays within thumb reach beside the opening illustration.
class StartTask extends StatelessWidget {
  const StartTask({super.key});

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.bottomCenter,
    child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 12),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
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
