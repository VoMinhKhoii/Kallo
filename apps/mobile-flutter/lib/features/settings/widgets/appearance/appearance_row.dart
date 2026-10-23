import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/list/list_row.dart';
import '../../../../theme/theme_controller.dart';
import 'appearance_sheet.dart';

/// "Appearance … System ›" — the current choice as the row's quiet value; a
/// tap opens [AppearanceSheet]. A device setting, so it needs no profile.
class AppearanceRow extends ConsumerWidget {
  const AppearanceRow({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListRow(
      icon: LucideIcons.sunMoon300,
      label: tr('settings.appearance.title'),
      value: appearanceLabel(ref.watch(kalloThemeProvider)),
      showChevron: true,
      onTap: () => showAppearanceSheet(context),
    );
  }
}
