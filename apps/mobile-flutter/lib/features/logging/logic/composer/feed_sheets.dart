import 'package:flutter/material.dart';

import '../../../../models/logging/scan_outcome.dart';
import '../../widgets/relog/mention_text_controller.dart';
import '../../widgets/sheets/manual/manual_log_sheet.dart';
import '../meal_log_mode.dart';
import '../relog/scan_purpose.dart';
import '../relog/scanned_pick.dart';
import 'composer_actions.dart';

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
    required this.focusComposer,
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

  /// Put the caret back in the composer. Two callers: a scan that gave up on
  /// the product hands the user the keyboard instead, and a scan that DID come
  /// back as a pick hands it back too — the sentence is half-typed and the
  /// sheet took the keyboard away to open the camera.
  final VoidCallback focusComposer;

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
    final outcome = await openScanSheet(
      context,
      purpose: ScanPurpose.log,
      userId: userId,
      date: date,
      onFallbackToText: focusComposer,
    );
    if (outcome is ScanSaved) onLogged();
  }

  /// The composer's scan icon. Normal mode splices the product into the
  /// sentence as a pick; every other mode logs it on the spot.
  ///
  /// A pick cannot ride a cheat submit: `planComposerSubmit` only carries refs
  /// on the normal path, so in cheat mode the reference would be dropped while
  /// its label survived as prose — the user would watch the scanned product
  /// turn back into words and be estimated. One shot, saved on the spot, is
  /// what this icon did in every mode before picks existed; cheat keeps it.
  Future<void> openBarcodeFromComposer() =>
      mode == MealLogMode.normal ? openBarcodePick() : openBarcode();

  /// The pick branch itself: the product joins the sentence being typed.
  Future<void> openBarcodePick() async {
    final outcome = await openScanSheet(
      context,
      purpose: ScanPurpose.pick,
      userId: userId,
      date: date,
      onFallbackToText: focusComposer,
    );
    // The nutrition-LABEL branch inside the same sheet still writes a meal —
    // there is no reference to hand back for a photographed table — so that
    // one lands in the feed and wants carrying into view.
    if (outcome is ScanSaved) return onLogged();
    if (outcome is ScanPicked && context.mounted) {
      // The keyboard left with the camera. A pick lands mid-sentence, so the
      // caret has to come back with it or the user taps the field to carry on
      // typing the half-written meal they were already writing.
      if (stageScannedPick(context, composer, outcome)) focusComposer();
    }
  }
}
