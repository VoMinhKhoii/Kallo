import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/top_toast.dart';
import '../widgets/settings_group.dart';

/// The marketing version string (no `package_info_plus` dependency in pubspec,
/// so this is rendered statically — keep in sync with `pubspec.yaml`).
const String _appVersion = '1.0.1';
const String _privacyUrl = 'https://kallo.fit/privacy';
const String _termsUrl = 'https://kallo.fit/terms';

/// The About/legal group on the settings root: version, privacy, terms.
/// Extracted from `settings_screen.dart` to keep that file within its size
/// baseline.
class AboutSection extends StatelessWidget {
  const AboutSection({super.key});

  @override
  Widget build(BuildContext context) {
    return SettingsGroup(
      label: tr('settings.about.title'),
      children: [
        SettingsRow(
          icon: LucideIcons.info,
          label: tr('settings.about.version'),
          value: _appVersion,
        ),
        SettingsRow(
          icon: LucideIcons.shieldCheck,
          label: tr('settings.about.privacy'),
          subline: _privacyUrl,
          onTap: () => _copyLink(context, _privacyUrl),
        ),
        SettingsRow(
          icon: LucideIcons.fileText,
          label: tr('settings.about.terms'),
          subline: _termsUrl,
          onTap: () => _copyLink(context, _termsUrl),
        ),
      ],
    );
  }

  void _copyLink(BuildContext context, String url) {
    Clipboard.setData(ClipboardData(text: url));
    showTopToast(context, tr('common.copied'));
  }
}
