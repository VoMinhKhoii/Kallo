/// What the barcode frame SAYS for a given flow state.
///
/// Split from the capsule that draws it: one side owns the mapping from a
/// lookup's phase to a message and its ways out, the other owns how that reads
/// on a moving picture. Keeping them apart is what lets the sheet stay a
/// question of when a frame is on screen, never of what it reports.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../data/barcode_providers.dart';
import 'barcode_frame_notice.dart';

/// The frame's notice for [state] — the lookup in flight, then whatever came
/// back. Null while there is nothing to say.
BarcodeFrameNotice? barcodeFrameNoticeFor(
  BarcodeFlowState state, {
  required VoidCallback onScanLabelInstead,
  VoidCallback? onLogByText,
}) {
  if (state.phase == BarcodeFlowPhase.searching) {
    return BarcodeFrameNotice(
      message: 'logging.barcode.searching'.tr(),
      detail: state.lastBarcode,
      busy: true,
    );
  }
  final errorKey = state.errorKey;
  if (errorKey == null) return null;
  return BarcodeFrameNotice(
    message: errorKey.tr(),
    detail: state.lastBarcode,
    routes: [
      // A product Open Food Facts doesn't know still has its nutrition table
      // printed on the box — offer to read that instead.
      if (state.isNotFound)
        BarcodeFrameRoute(
          label: 'logging.scan.tryLabelInstead'.tr(),
          onTap: onScanLabelInstead,
        ),
      if (state.isNotFound && onLogByText != null)
        BarcodeFrameRoute(
          label: 'logging.barcode.logByText'.tr(),
          onTap: onLogByText,
        ),
    ],
  );
}
