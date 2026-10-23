import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../shared/widgets/list/list_row.dart';
import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_palette.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../theme/theme_controller.dart';

/// Opens the Appearance picker: System, Light, Dark, Aurora.
Future<void> showAppearanceSheet(BuildContext context) =>
    showNhamSheet<void>(context, builder: (_) => const AppearanceSheet());

/// The localized name of a choice — the picker rows and the Settings row's
/// value both say it.
String appearanceLabel(KalloThemeChoice choice) =>
    tr('settings.appearance.${choice.name}');

/// The icon of a choice, the same ones the web app shows.
IconData appearanceIcon(KalloThemeChoice choice) => switch (choice) {
  KalloThemeChoice.system => LucideIcons.monitor300,
  KalloThemeChoice.light => LucideIcons.sun300,
  KalloThemeChoice.dark => LucideIcons.moon300,
  KalloThemeChoice.aurora => LucideIcons.sunset300,
};

/// One grouped card of the four choices, each with its icon, and a tick on the
/// current one — the app's single-select sheet pattern (`CheatIntensityPage`):
/// no fill behind the chosen row, the tick is the whole signal. Dividers start
/// under the labels, past the icons, as on the Settings list. A pick applies at once and closes
/// the sheet, which then slides away already in the new palette.
class AppearanceSheet extends ConsumerWidget {
  const AppearanceSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(kalloThemeProvider);
    // Floors at sp4 for phones with no home indicator to inset against.
    final bottomInset = math.max(
      MediaQuery.viewPaddingOf(context).bottom,
      KalloSpacing.sp4,
    );
    return KalloSheetSurface(
      scrollable: true,
      padding: EdgeInsets.only(
        left: KalloSpacing.sp4,
        right: KalloSpacing.sp4,
        bottom: bottomInset,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KalloSheetHeader(title: tr('settings.appearance.title')),
          GroupedListCard(
            children: [
              for (final choice in KalloThemeChoice.values)
                ListRow(
                  icon: appearanceIcon(choice),
                  label: appearanceLabel(choice),
                  onTap: () {
                    HapticFeedback.selectionClick();
                    ref.read(kalloThemeProvider.notifier).select(choice);
                    Navigator.of(context).pop();
                  },
                  trailing:
                      choice == current
                          ? Icon(
                            LucideIcons.check300,
                            size: KalloIcons.size,
                            color: KalloColors.text,
                          )
                          : null,
                ),
            ],
          ),
        ],
      ),
    );
  }
}
