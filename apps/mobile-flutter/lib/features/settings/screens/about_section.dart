import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../shared/widgets/toast/top_toast.dart';
import '../../feedback/screens/feedback_screen.dart';
import '../widgets/list/settings_group.dart';
import '../widgets/list/settings_row.dart';

/// The marketing version string (no `package_info_plus` dependency in pubspec,
/// so this is rendered statically — keep in sync with `pubspec.yaml`).
const String _appVersion = '1.0.1';
// The legal pages live in the docs site now. The bare /privacy and /terms
// paths still redirect there, but building the canonical URL here means the
// link lands directly, in the language the app is running in, rather than
// going through a redirect that re-detects the locale from scratch.
const String _docsBase = 'https://kallo.fit';

String _privacyUrl(String locale) => '$_docsBase/$locale/docs/legal/privacy';

String _termsUrl(String locale) => '$_docsBase/$locale/docs/legal/terms';

/// The About group on the settings root: feedback, version, and the legal
/// pages. Extracted from `settings_screen.dart` to keep that file within its
/// size baseline.
///
/// Feedback lives here rather than under a header of its own. A single-row
/// group spent a whole section label and two 24px gaps on one row, and section
/// labels are the most expensive thing on a screen this flat.
///
/// The legal rows OPEN their page rather than copying its URL. They used to
/// carry the raw URL as a subline — the one piece of text on the screen that
/// read as a database field — and copying a link on tap is a surprising thing
/// for a row to do with no affordance saying so.
class AboutSection extends StatelessWidget {
  const AboutSection({super.key});

  @override
  Widget build(BuildContext context) {
    // The web docs ship in the same two locales as the app, so the language
    // code maps across directly; anything unexpected falls back to English.
    final languageCode = context.locale.languageCode;
    final locale = languageCode == 'vi' ? 'vi' : 'en';

    return SettingsGroup(
      label: tr('settings.about.title'),
      children: [
        SettingsRow(
          icon: LucideIcons.messageSquare300,
          label: tr('settings.feedback.rowLabel'),
          showChevron: true,
          onTap: () => _openFeedback(context),
        ),
        SettingsRow(
          icon: LucideIcons.info300,
          label: tr('settings.about.version'),
          value: _appVersion,
        ),
        SettingsRow(
          icon: LucideIcons.shieldCheck300,
          label: tr('settings.about.privacy'),
          showChevron: true,
          onTap: () => _openLink(context, _privacyUrl(locale)),
        ),
        SettingsRow(
          icon: LucideIcons.fileText300,
          label: tr('settings.about.terms'),
          showChevron: true,
          onTap: () => _openLink(context, _termsUrl(locale)),
        ),
      ],
    );
  }

  void _openFeedback(BuildContext context) {
    Navigator.of(
      context,
    ).push(CupertinoPageRoute<void>(builder: (_) => const FeedbackScreen()));
  }

  /// Opens a docs page in the platform browser, mirroring
  /// `openStoreSubscriptions` — a failed launch has to say so, otherwise the
  /// tap reads as a dead row.
  Future<void> _openLink(BuildContext context, String url) async {
    final opened = await launchUrl(
      Uri.parse(url),
      mode: LaunchMode.externalApplication,
    );
    if (!opened && context.mounted) {
      showTopToast(
        context,
        tr('common.error'),
        variant: TopToastVariant.error,
      );
    }
  }
}
