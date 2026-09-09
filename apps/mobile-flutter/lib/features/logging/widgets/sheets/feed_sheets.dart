import 'package:flutter/material.dart';

import '../../logic/meal_log_mode.dart';
import '../../logic/relog/scanned_pick.dart';
import '../../../../models/logging/scan_outcome.dart';
import '../composer/composer_actions.dart';
import '../relog/mention_text_controller.dart';
import 'manual/manual_log_sheet.dart';

/// The sheets the feed composer can open over itself.
///
/// All three open OVER the feed: there is no sheet of ours in the way, so the
/// mode sheet's own dismissal is the only thing to wait on. The dashboard's
/// quick-log sheet cannot do this — a sheet must not stack on a sheet, so it
/// closes itself and hands the launch back to the surface underneath.
class FeedSheets {
  const FeedSheets({
    required this.context,
    required this.userId,
    required this.date,
    required this.mode,
    required this.onPersistentMode,
    required this.onFallbackToText,
    required this.composer,
    required this.onLogged,
  });

  final BuildContext context;
  final String userId;
  final String date;

  /// The persistent mode the chooser opens on.
  final MealLogMode mode;

  /// Normal / Cheat — the chooser's two persistent outcomes.
  final ValueChanged<MealLogMode> onPersistentMode;

  /// Barcode gave up (product not found): hand the user the keyboard instead.
  final VoidCallback onFallbackToText;

  /// Where a scanned product lands when the COMPOSER asked for the scan.
  final MentionTextEditingController composer;

  /// A sheet WROTE a meal: bring it into view, as a send does. Not fired for a
  /// sheet the user simply closed — a cancel must move nothing.
  final VoidCallback onLogged;

  Future<void> openMode() => chooseLogMode(
    context,
    current: mode,
    onPersistentMode: onPersistentMode,
    onManual: openManual,
    onBarcode: openBarcode,
  );

  Future<void> openManual() =>
      showManualLogSheet(context, userId: userId, date: date);

  /// The mode chooser's Scan row: one shot, saved on the spot.
  Future<void> openBarcode() async {
    final outcome = await openScanLogSheet(
      context,
      userId: userId,
      date: date,
      onFallbackToText: onFallbackToText,
    );
    if (outcome is ScanSaved) onLogged();
  }

  /// The composer's scan icon: the product joins the sentence being typed.
  Future<void> openBarcodePick() async {
    final outcome = await openScanPickSheet(
      context,
      userId: userId,
      date: date,
      onFallbackToText: onFallbackToText,
    );
    // The nutrition-LABEL branch inside the same sheet still writes a meal —
    // there is no reference to hand back for a photographed table — so that
    // one lands in the feed and wants carrying into view.
    if (outcome is ScanSaved) return onLogged();
    if (outcome is ScanPicked && context.mounted) {
      stageScannedPick(context, composer, outcome);
    }
  }
}
