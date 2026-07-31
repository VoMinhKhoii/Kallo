import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart' show defaultTargetPlatform;
import 'package:flutter/material.dart' show IconData, TargetPlatform;
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// How a meal gets logged. `normal` = describe it in words (AI); `cheat` = the
/// slider-estimate flow for hard-to-count occasions; `manual` = search foods +
/// grams; `barcode` = scan a packaged product.
///
/// Lives in `logic/` rather than beside the picker sheet because the persistent
/// half of it is app state (`mealLogModeProvider`), and the data layer must not
/// have to import a widget to name it.
enum MealLogMode { normal, cheat, manual, barcode }

/// Single source of truth for whether barcode logging is offered. iOS-only for
/// now — Android support (permission copy, device testing) is unscoped. Every
/// entry point (the mode sheet's row, the composer icon) gates on this so they
/// can't drift apart.
bool get isBarcodeLoggingSupported =>
    defaultTargetPlatform == TargetPlatform.iOS;

IconData mealModeIcon(MealLogMode mode) => switch (mode) {
  MealLogMode.normal => LucideIcons.zap300, // lightning
  MealLogMode.cheat => LucideIcons.pizza300,
  MealLogMode.manual => LucideIcons.pencil300,
  MealLogMode.barcode => LucideIcons.scanBarcode300,
};

String mealModeLabel(MealLogMode mode) => switch (mode) {
  MealLogMode.normal => 'logging.modeSelector.normal'.tr(),
  MealLogMode.cheat => 'logging.modeSelector.cheat'.tr(),
  MealLogMode.manual => 'logging.modeSelector.manual'.tr(),
  MealLogMode.barcode => 'logging.modeSelector.barcode'.tr(),
};
