import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart' show defaultTargetPlatform;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/nham_sheet.dart';
import '../../../shared/widgets/nham_text.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';

/// How a meal gets logged. `normal` = describe it in words (AI); `cheat` = the
/// slider-estimate flow for hard-to-count occasions; `manual` = search foods +
/// grams; `barcode` = scan a packaged product.
enum MealLogMode { normal, cheat, manual, barcode }

/// Single source of truth for whether barcode logging is offered. iOS-only for
/// now — Android support (permission copy, device testing) is unscoped. Both
/// entry points (this mode sheet's row and the composer icon in `feed_area`)
/// gate on this so they can't drift apart.
bool get isBarcodeLoggingSupported =>
    defaultTargetPlatform == TargetPlatform.iOS;

IconData mealModeIcon(MealLogMode mode) => switch (mode) {
  MealLogMode.normal => LucideIcons.zap, // lightning
  MealLogMode.cheat => LucideIcons.pizza,
  MealLogMode.manual => LucideIcons.pencil,
  MealLogMode.barcode => LucideIcons.scanBarcode,
};

String mealModeLabel(MealLogMode mode) => switch (mode) {
  MealLogMode.normal => 'logging.modeSelector.normal'.tr(),
  MealLogMode.cheat => 'logging.modeSelector.cheat'.tr(),
  MealLogMode.manual => 'logging.modeSelector.manual'.tr(),
  MealLogMode.barcode => 'logging.modeSelector.barcode'.tr(),
};

/// Opens the "select mode" chooser — the first step before the composer. Minimal
/// list (bare colored icon · title · description · check), mirroring the Claude
/// Code mobile mode selector. Returns the picked mode (or null if dismissed).
Future<MealLogMode?> showMealModeSheet(
  BuildContext context, {
  required MealLogMode current,
}) {
  return showNhamSheet<MealLogMode>(
    context,
    builder: (context) => _MealModeSheet(current: current),
  );
}

class _MealModeSheet extends StatelessWidget {
  const _MealModeSheet({required this.current});

  final MealLogMode current;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return NhamSheetSurface(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          NhamSheetHeader(title: 'logging.modeSelector.title'.tr()),
          Padding(
            padding: EdgeInsets.fromLTRB(
              NhamSpacing.sp3,
              NhamSpacing.sp2,
              NhamSpacing.sp3,
              bottomInset + NhamSpacing.sp4,
            ),
            child: Column(
              children: [
                _ModeRow(
                  icon: mealModeIcon(MealLogMode.normal),
                  iconColor: NhamColors.text,
                  title: 'logging.modeSelector.normal'.tr(),
                  desc: 'logging.modeSelector.normalDesc'.tr(),
                  selected: current == MealLogMode.normal,
                  onTap: () => Navigator.of(context).pop(MealLogMode.normal),
                ),
                _ModeRow(
                  icon: mealModeIcon(MealLogMode.cheat),
                  iconColor: NhamColors.danger,
                  title: 'logging.modeSelector.cheat'.tr(),
                  desc: 'logging.modeSelector.cheatDesc'.tr(),
                  selected: current == MealLogMode.cheat,
                  onTap: () => Navigator.of(context).pop(MealLogMode.cheat),
                ),
                _ModeRow(
                  icon: mealModeIcon(MealLogMode.manual),
                  iconColor: NhamColors.text,
                  title: 'logging.modeSelector.manual'.tr(),
                  desc: 'logging.modeSelector.manualDesc'.tr(),
                  selected: current == MealLogMode.manual,
                  onTap: () => Navigator.of(context).pop(MealLogMode.manual),
                ),
                if (isBarcodeLoggingSupported)
                  _ModeRow(
                    icon: mealModeIcon(MealLogMode.barcode),
                    iconColor: NhamColors.text,
                    title: 'logging.modeSelector.barcode'.tr(),
                    desc: 'logging.modeSelector.barcodeDesc'.tr(),
                    selected: current == MealLogMode.barcode,
                    onTap: () => Navigator.of(context).pop(MealLogMode.barcode),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ModeRow extends StatefulWidget {
  const _ModeRow({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.desc,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String desc;
  final bool selected;
  final VoidCallback onTap;

  @override
  State<_ModeRow> createState() => _ModeRowState();
}

class _ModeRowState extends State<_ModeRow> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () {
        HapticFeedback.selectionClick();
        widget.onTap();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        padding: const EdgeInsets.symmetric(
          horizontal: NhamSpacing.sp2,
          vertical: NhamSpacing.sp3,
        ),
        decoration: BoxDecoration(
          color: _pressed ? NhamColors.hover40 : Colors.transparent,
          borderRadius: BorderRadius.circular(NhamRadii.container20),
        ),
        child: Row(
          children: [
            Icon(widget.icon, size: 24, color: widget.iconColor),
            const SizedBox(width: NhamSpacing.sp3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  NhamText(
                    widget.title,
                    variant: NhamTextVariant.body,
                    style: dashBody(weight: FontWeight.w500),
                  ),
                  const SizedBox(height: 1),
                  NhamText(
                    widget.desc,
                    variant: NhamTextVariant.small,
                    style: dashMeta(),
                  ),
                ],
              ),
            ),
            if (widget.selected)
              const Icon(LucideIcons.check, size: 20, color: NhamColors.text),
          ],
        ),
      ),
    );
  }
}

