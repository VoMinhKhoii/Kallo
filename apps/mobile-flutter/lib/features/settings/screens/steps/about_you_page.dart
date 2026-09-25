import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../onboarding/screens/step_about_you.dart';
import '../../logic/step_session.dart';
import '../../widgets/chrome/settings_step_page.dart';

/// "Chỉ số cơ thể" — onboarding screen 3 (sex, weight, height, age, activity)
/// as a Settings page. Its own root row, so body metrics are found by name
/// instead of inside "Mục tiêu & tốc độ".
class AboutYouPage extends StatelessWidget {
  const AboutYouPage({super.key});

  @override
  Widget build(BuildContext context) => SettingsStepPage(
    step: SettingsStep.aboutYou,
    title: tr('settings.rows.aboutYou'),
    builder:
        (context, page) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            StepAboutYou(
              answers: page.session.answers,
              onChanged: page.session.changed,
            ),
            // Step 2 posts every metric at once: an edit that leaves one
            // blank is dirty but not savable, so say why the button waits.
            if (page.session.dirty && page.session.payload == null) ...[
              const SizedBox(height: KalloSpacing.sp3),
              Text(
                tr('settings.profilePanel.incompleteHint'),
                style: dashMeta(),
              ),
            ],
          ],
        ),
  );
}
