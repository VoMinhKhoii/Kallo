import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/top_toast.dart';
import '../widgets/settings_group.dart';
import '../widgets/settings_row.dart';

/// The marketing version string (no `package_info_plus` dependency in pubspec,
/// so this is rendered statically — keep in sync with `pubspec.yaml`).
const String _appVersion = '1.0.1';
// The legal pages live in the docs site now. The bare /privacy and /terms
// paths still redirect there, but building the canonical URL here means the
// copied link lands directly, in the language the app is running in, rather
// than going through a redirect that re-detects the locale from scratch.
const String _docsBase = 'https://kallo.fit';

String _privacyUrl(String locale) => '$_docsBase/$locale/docs/legal/privacy';

String _termsUrl(String locale) => '$_docsBase/$locale/docs/legal/terms';

/// The About/legal group on the settings root: version, privacy, terms.
/// Extracted from `settings_screen.dart` to keep that file within its size
/// baseline.
class AboutSection extends StatelessWidget {
  const AboutSection({super.key});

  @override
  Widget build(BuildContext context) {
    // The web docs ship in the same two locales as the app, so the language
    // code maps across directly; anything unexpected falls back to English.
    final languageCode = context.locale.languageCode;
    final locale = languageCode == 'vi' ? 'vi' : 'en';
    final privacyUrl = _privacyUrl(locale);
    final termsUrl = _termsUrl(locale);

    return SettingsGroup(
      label: tr('settings.about.title'),
      children: [
        SettingsRow(
          icon: LucideIcons.info300,
          label: tr('settings.about.version'),
          value: _appVersion,
        ),
        SettingsRow(
          icon: LucideIcons.shieldCheck300,
          label: tr('settings.about.privacy'),
          subline: privacyUrl,
          onTap: () => _copyLink(context, privacyUrl),
        ),
        SettingsRow(
          icon: LucideIcons.fileText300,
          label: tr('settings.about.terms'),
          subline: termsUrl,
          onTap: () => _copyLink(context, termsUrl),
        ),
      ],
    );
  }

  void _copyLink(BuildContext context, String url) {
    Clipboard.setData(ClipboardData(text: url));
    showTopToast(context, tr('common.copied'));
  }
}
