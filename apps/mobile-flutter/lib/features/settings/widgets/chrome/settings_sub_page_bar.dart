import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';

import '../../../../shared/widgets/chrome/inline_nav_bar.dart';

/// The bar every page one level under Settings wears: "‹ Cài đặt" and the
/// page's own title centred ([InlineNavBar.page]).
///
/// Only the settings ROOT keeps the large left-aligned `PageHeader`; a
/// sub-page wearing that same 28pt headline read as another top-level screen.
class SettingsSubPageBar extends StatelessWidget {
  const SettingsSubPageBar({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) =>
      InlineNavBar.page(title: title, parentTitle: tr('settings.title'));
}
