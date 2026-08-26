import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import 'package:url_launcher/url_launcher.dart';

import '../widgets/toast/top_toast.dart';

/// The legal pages live on the docs site. The bare `/privacy` and `/terms`
/// paths still redirect there, but building the canonical URL means the link
/// lands directly, in the language the app is running in, rather than going
/// through a redirect that re-detects the locale from scratch.
const String _docsBase = 'https://kallo.fit';

/// The docs site ships in the same two locales as the app, so the language code
/// maps across directly; anything unexpected falls back to English.
String _docsLocale(String languageCode) => languageCode == 'vi' ? 'vi' : 'en';

String _legalUrl(String languageCode, String page) =>
    '$_docsBase/${_docsLocale(languageCode)}/docs/legal/$page';

String privacyUrlFor(String languageCode) => _legalUrl(languageCode, 'privacy');

String termsUrlFor(String languageCode) => _legalUrl(languageCode, 'terms');

/// Opens a legal page in an **in-app** browser — `SFSafariViewController` on
/// iOS, a Custom Tab on Android — so the page arrives over the app with a Done
/// button instead of ejecting into a separate browser app. That is what the
/// settings row's chevron promises, and it keeps the paywall's own links from
/// dropping someone out of a purchase flow they were mid-way through.
///
/// Falls back to the external browser when the platform has no in-app view.
/// [launchUrl] both returns false AND throws depending on platform and mode, so
/// a failed in-app attempt must not surface as an error before the fallback has
/// had its turn. If neither opens, say so: a tap that does nothing reads as a
/// dead row.
Future<void> openLegalPage(BuildContext context, String url) async {
  final uri = Uri.parse(url);
  if (await _tryLaunch(uri, LaunchMode.inAppBrowserView)) return;
  if (await _tryLaunch(uri, LaunchMode.externalApplication)) return;
  if (context.mounted) {
    showTopToast(context, tr('common.error'), variant: TopToastVariant.error);
  }
}

Future<bool> _tryLaunch(Uri uri, LaunchMode mode) async {
  try {
    return await launchUrl(uri, mode: mode);
  } catch (_) {
    return false;
  }
}
