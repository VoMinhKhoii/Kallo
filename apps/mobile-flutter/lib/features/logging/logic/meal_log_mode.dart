import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart' show defaultTargetPlatform;
import 'package:flutter/material.dart' show IconData, TargetPlatform;
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// How a meal gets logged. `normal` = describe it in words (AI); `cheat` = the
/// slider-estimate flow for hard-to-count occasions; `manual` = search foods +
/// grams; `barcode` = scan a packaged product, by its barcode OR by the
/// nutrition table printed on it (one sheet, two scanners — see
/// `scan_sheet.dart`). The enum value keeps its original name because it is
/// persisted composer state and read by every entry point.
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

/// Whether the label sheet offers "enter nutrition by hand" as an escape
/// hatch. Off for now — typing 28 nutrients off a package is a worse job than
/// [MealLogMode.manual] already does with a food search, and offering it
/// beside the camera invited it before the scan had been tried.
///
/// Lives beside [isBarcodeLoggingSupported] because it is the same kind of
/// thing: one place deciding whether a logging affordance is offered, so the
/// capture step's link and the failure card's action cannot drift apart. The
/// controller's `enterManualReview()` stays wired and tested — flipping this
/// back on is the whole change.
const bool isManualNutritionEntryOffered = false;

IconData mealModeIcon(MealLogMode mode) => switch (mode) {
  MealLogMode.normal => LucideIcons.zap300, // lightning
  MealLogMode.cheat => LucideIcons.pizza300,
  MealLogMode.manual => LucideIcons.pencil300,
  // Not `scanBarcode`: the row now covers the nutrition label too.
  MealLogMode.barcode => LucideIcons.scanLine300,
};

String mealModeLabel(MealLogMode mode) => switch (mode) {
  MealLogMode.normal => 'logging.modeSelector.normal'.tr(),
  MealLogMode.cheat => 'logging.modeSelector.cheat'.tr(),
  MealLogMode.manual => 'logging.modeSelector.manual'.tr(),
  MealLogMode.barcode => 'logging.modeSelector.barcode'.tr(),
};
