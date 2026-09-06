import 'dart:io';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../shared/widgets/form/sheet_action_buttons.dart';
import '../../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../logic/label/image.dart';
import '../../../logic/meal_log_mode.dart';
import '../scan/scan_camera_stage.dart';
import 'label_camera_preview.dart';

/// Take (or choose) a photo of the nutrition table, then send it to be read.
///
/// The capture controls moved INSIDE the dark stage in the native pass
/// (2026-08-31): an iPhone-style shutter with the photo-library button beside
/// it, replacing the umber "Take photo" bar and the beige library pill that
/// used to stack under the frame. Only the held-photo step still shows a
/// full-width button, because "read this label" is a commit, not a capture.
///
/// The stage now runs a LIVE camera ([LabelCameraPreview]) rather than sitting
/// dark behind a shutter that opened the OS camera modal — the barcode branch
/// has shown a picture from the first frame all along.
class LabelCaptureStep extends StatelessWidget {
  const LabelCaptureStep({
    super.key,
    required this.image,
    required this.scanning,
    required this.onPick,
    required this.onCapture,
    required this.onCaptureFailure,
    required this.onScan,
    required this.onRetake,
    required this.onManualEntry,
  });

  final LabelImage? image;
  final bool scanning;

  /// The photo-library path only — the shutter no longer goes through the
  /// picker's camera modal.
  final ValueChanged<ImageSource> onPick;

  /// The path of a still the in-sheet camera wrote. Deliberately NOT the
  /// picker's pixels: the live camera shoots at `veryHigh` (~1080p) and hands
  /// the file over untouched, where `image_picker` resizes to 1600px at q85 on
  /// the way out. Both clear the model's needs and the payload cap; see
  /// `LabelScanController.captureFromFile`.
  final ValueChanged<String> onCapture;

  /// A camera that would not open or would not shoot.
  final ValueChanged<LabelImageFailure> onCaptureFailure;

  final VoidCallback onScan;
  final VoidCallback onRetake;

  /// Escape hatch for a label the model can't read — opens an empty review
  /// form rather than leaving the user stuck at the camera.
  final VoidCallback onManualEntry;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewPaddingOf(context).bottom;
    final held = image;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        KalloSpacing.sp4,
        KalloSpacing.sp2,
        KalloSpacing.sp4,
        bottomInset + KalloSpacing.sp2,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children:
            held == null ? _chooseChildren(context) : _previewChildren(held),
      ),
    );
  }

  List<Widget> _chooseChildren(BuildContext context) => [
    LabelCameraPreview(
      hint: 'logging.labelScan.captureGuide'.tr(),
      shutterLabel: 'logging.labelScan.takePhoto'.tr(),
      leading: _LibraryButton(onTap: () => onPick(ImageSource.gallery)),
      onCaptured: onCapture,
      onFailure: onCaptureFailure,
    ),
    if (isManualNutritionEntryOffered) ...[
      const SizedBox(height: KalloSpacing.sp1),
      Center(
        child: QuietIconButton(
          icon: LucideIcons.keyboard300,
          label: 'logging.labelScan.manualEntry'.tr(),
          onTap: onManualEntry,
        ),
      ),
    ],
  ];

  List<Widget> _previewChildren(LabelImage held) => [
    ScanCameraStage(
      builder: (context, size) => Image.file(
        File(held.path),
        fit: BoxFit.cover,
        // The picker wrote this file moments ago; if it has vanished the
        // useful move is to shoot another, not to crash the sheet.
        errorBuilder: (context, _, __) => const Center(
          child: Icon(
            LucideIcons.imageOff300,
            size: KalloIcons.size,
            color: KalloColors.textMuted,
          ),
        ),
      ),
    ),
    const SizedBox(height: KalloSpacing.sp3),
    KalloButton(
      title: 'logging.labelScan.scanPhoto'.tr(),
      loading: scanning,
      onPressed: onScan,
    ),
    if (!scanning) ...[
      const SizedBox(height: KalloSpacing.sp1),
      Center(
        child: QuietIconButton(
          icon: LucideIcons.rotateCcw300,
          label: 'logging.labelScan.retake'.tr(),
          onTap: onRetake,
        ),
      ),
    ],
  ];
}

/// The photo-library button beside the shutter — the beige pill's replacement.
class _LibraryButton extends StatelessWidget {
  const _LibraryButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'logging.labelScan.choosePhoto'.tr(),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: const Center(
          child: Icon(
            LucideIcons.image300,
            size: KalloIcons.size,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}
