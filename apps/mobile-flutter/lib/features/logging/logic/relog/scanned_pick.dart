/// Putting a scanned product into the sentence being typed.
///
/// The `/` picker's own commit lives on the controller; this is the other half
/// of the same idea, and it is here rather than beside the scan sheet because
/// the sheet must not know what a composer is — it hands back a
/// [ScanPicked] and is done.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import '../../../../models/logging/relog.dart';
import '../../../../models/logging/scan_outcome.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../widgets/relog/mention_text_controller.dart';

const _uuid = Uuid();

/// Splice [picked] in at the caret, or say why not.
///
/// The staged cap is shared with the `/` picks — they ride the same submit and
/// the same server-side limit — so a refusal has to be told, not swallowed.
void stageScannedPick(
  BuildContext context,
  MentionTextEditingController composer,
  ScanPicked picked,
) {
  if (composer.insertPick(picked.label, picked.ref, _uuid.v4())) return;
  showTopToast(
    context,
    'logging.relog.stagedFull'.tr(namedArgs: {'max': '$kRelogMaxStaged'}),
  );
}
