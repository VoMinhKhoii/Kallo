import 'dart:io';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../shared/widgets/nham_text.dart';
import '../../../../../theme/nham_colors.dart';
import '../../../../../theme/nham_theme.dart';
import '../../../logic/label_image.dart';
import '../../../logic/meal_log_mode.dart';
import '../scan_sheet_controls.dart';

/// Take (or choose) a photo of the nutrition table, then send it to be read.
///
/// Port of `components/logging/input/ocr-scanner-tab.tsx`: the same capture
/// guidance, the same camera-or-library choice, and the same preview with a
/// retake before anything is uploaded.
class LabelCaptureStep extends StatelessWidget {
  const LabelCaptureStep({
    super.key,
    required this.image,
    required this.scanning,
    required this.onPick,
    required this.onScan,
    required this.onRetake,
    required this.onManualEntry,
  });

  final LabelImage? image;
  final bool scanning;
  final ValueChanged<ImageSource> onPick;
  final VoidCallback onScan;
  final VoidCallback onRetake;

  /// Escape hatch for a label the model can't read — opens an empty review
  /// form rather than leaving the user stuck at the camera.
  final VoidCallback onManualEntry;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    final held = image;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        NhamSpacing.sp4,
        NhamSpacing.sp2,
        NhamSpacing.sp4,
        bottomInset + NhamSpacing.sp3,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children:
            held == null ? _chooseChildren(context) : _previewChildren(held),
      ),
    );
  }

  List<Widget> _chooseChildren(BuildContext context) => [
    NhamText(
      'logging.labelScan.captureGuide'.tr(),
      variant: NhamTextVariant.small,
      textAlign: TextAlign.center,
      style: const TextStyle(color: NhamColors.textMuted),
    ),
    const SizedBox(height: NhamSpacing.sp3),
    ScanPrimaryButton(
      label: 'logging.labelScan.takePhoto'.tr(),
      onTap: () => onPick(ImageSource.camera),
    ),
    const SizedBox(height: NhamSpacing.sp2),
    ScanOutlineButton(
      icon: LucideIcons.image300,
      label: 'logging.labelScan.choosePhoto'.tr(),
      onTap: () => onPick(ImageSource.gallery),
    ),
    if (isManualNutritionEntryOffered) ...[
      const SizedBox(height: NhamSpacing.sp2),
      Center(
        child: ScanQuietButton(
          icon: LucideIcons.keyboard300,
          label: 'logging.labelScan.manualEntry'.tr(),
          onTap: onManualEntry,
        ),
      ),
    ],
  ];

  List<Widget> _previewChildren(LabelImage held) => [
    ClipRRect(
      borderRadius: BorderRadius.circular(NhamRadii.containerLg),
      child: AspectRatio(
        aspectRatio: 3 / 4,
        child: Image.file(
          File(held.path),
          fit: BoxFit.cover,
          // The picker wrote this file moments ago; if it has vanished the
          // useful move is to shoot another, not to crash the sheet.
          errorBuilder:
              (context, _, __) => Container(
                color: NhamColors.track,
                alignment: Alignment.center,
                child: const Icon(
                  LucideIcons.imageOff300,
                  size: 24,
                  color: NhamColors.textMuted,
                ),
              ),
        ),
      ),
    ),
    const SizedBox(height: NhamSpacing.sp3),
    ScanPrimaryButton(
      label: 'logging.labelScan.scanPhoto'.tr(),
      busy: scanning,
      onTap: onScan,
    ),
    const SizedBox(height: NhamSpacing.sp2),
    if (!scanning)
      Center(
        child: ScanQuietButton(
          icon: LucideIcons.rotateCcw300,
          label: 'logging.labelScan.retake'.tr(),
          onTap: onRetake,
        ),
      ),
  ];
}
