import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/logic/legal_links.dart';
import '../../../shared/widgets/list/list_row.dart';
import '../../feedback/screens/feedback_screen.dart';
import '../widgets/list/settings_group.dart';

/// The marketing version string (no `package_info_plus` dependency in pubspec,
/// so this is rendered statically — keep in sync with `pubspec.yaml`).
///
/// It is NOT a row: the settings root prints it centred under the last card,
/// where a build number belongs. As a row it spent a full 56pt and an icon on
/// a value nobody navigates to.
const String kAppVersion = '1.0.1';

/// The About group on the settings root: feedback and the legal pages.
/// Extracted from `settings_screen.dart` to keep that file within its size
/// baseline.
///
/// Feedback lives here rather than under a header of its own. A single-row
/// group spent a whole section label and two 24px gaps on one row, and section
/// labels are the most expensive thing on a screen this flat.
///
/// The legal rows OPEN their page rather than copying its URL. They used to
/// carry the raw URL as a subline — the one piece of text on the screen that
/// read as a database field — and copying a link on tap is a surprising thing
/// for a row to do with no affordance saying so. The URLs and the in-app
/// browser both come from `shared/logic/legal_links.dart`, so the paywall's
/// links to the same two pages behave identically.
class AboutSection extends StatelessWidget {
  const AboutSection({super.key});

  @override
  Widget build(BuildContext context) {
    final languageCode = context.locale.languageCode;

    return SettingsGroup(
      label: tr('settings.about.title'),
      children: [
        ListRow(
          icon: LucideIcons.messageSquare300,
          label: tr('settings.feedback.rowLabel'),
          showChevron: true,
          onTap: () => _openFeedback(context),
        ),
        ListRow(
          icon: LucideIcons.shieldCheck300,
          label: tr('settings.about.privacy'),
          showChevron: true,
          onTap: () => openLegalPage(context, privacyUrlFor(languageCode)),
        ),
        ListRow(
          icon: LucideIcons.fileText300,
          label: tr('settings.about.terms'),
          showChevron: true,
          onTap: () => openLegalPage(context, termsUrlFor(languageCode)),
        ),
      ],
    );
  }

  void _openFeedback(BuildContext context) {
    Navigator.of(
      context,
    ).push(CupertinoPageRoute<void>(builder: (_) => const FeedbackScreen()));
  }
}
