import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../onboarding/screens/step_cooking.dart';
import '../../logic/step_session.dart';
import '../../widgets/chrome/settings_step_page.dart';

/// "Thói quen nấu nướng" — onboarding screen 5, every answer showing with its
/// hint and, for rice and protein, its portion drawing.
class CookingPage extends StatelessWidget {
  const CookingPage({super.key});

  @override
  Widget build(BuildContext context) => SettingsStepPage(
    step: SettingsStep.cooking,
    title: tr('settings.rows.cooking'),
    builder:
        (context, page) =>
            StepCooking(answers: page.session.answers, onChanged: page.changed),
  );
}
