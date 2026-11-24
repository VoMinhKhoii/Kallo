import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/typography/section_header_row.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../onboarding/screens/step_language.dart';
import '../../../onboarding/screens/step_origin.dart';
import '../../logic/step_session.dart';
import '../../widgets/chrome/settings_step_page.dart';

/// "Khu vực & ngôn ngữ" — onboarding screens 1 and 2 on one page: the app
/// language, then where the user cooks.
///
/// The language is the one answer that does not wait for the button: picking
/// it re-renders the whole app in that language at once and stores it on the
/// account ([StepLanguage] → `LanguagePicker`). The button saves the
/// countries.
class RegionPage extends StatefulWidget {
  const RegionPage({super.key});

  @override
  State<RegionPage> createState() => _RegionPageState();
}

class _RegionPageState extends State<RegionPage> {
  @override
  Widget build(BuildContext context) => SettingsStepPage(
    step: SettingsStep.region,
    title: tr('settings.rows.region'),
    builder: (context, page) {
      final answers = page.session.answers;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GroupLabel(tr('settings.language')),
          const SizedBox(height: KalloSpacing.sp3),
          StepLanguage(
            answers: answers,
            deviceLanguage: page.session.device.deviceLanguage,
            localeFromDevice: page.session.device.localeFromDevice,
            showSettingsNote: false,
            onChanged: page.session.changed,
          ),
          const SizedBox(height: KalloSpacing.sp6),
          GroupLabel(tr('onboarding.origin.stepTitle')),
          const SizedBox(height: KalloSpacing.sp3),
          StepOrigin(
            answers: answers,
            deviceCountry: page.session.device.deviceCountry,
            onChanged: page.session.changed,
          ),
        ],
      );
    },
  );
}
