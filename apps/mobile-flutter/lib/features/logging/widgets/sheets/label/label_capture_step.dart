import 'dart:io';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../shared/widgets/form/sheet_action_buttons.dart';
import '../../../../../shared/widgets/typography/kallo_text.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../logic/label/image.dart';
import '../../../logic/meal_log_mode.dart';

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
        KalloSpacing.sp4,
        KalloSpacing.sp2,
        KalloSpacing.sp4,
        bottomInset + KalloSpacing.sp3,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children:
            held == null ? _chooseChildren(context) : _previewChildren(held),
      ),
    );
  }

  List<Widget> _chooseChildren(BuildContext context) => [
    KalloText(
      'logging.labelScan.captureGuide'.tr(),
      variant: KalloTextVariant.small,
      textAlign: TextAlign.center,
      style: const TextStyle(color: KalloColors.textMuted),
    ),
    const SizedBox(height: KalloSpacing.sp3),
    SheetPrimaryButton(
      label: 'logging.labelScan.takePhoto'.tr(),
      onTap: () => onPick(ImageSource.camera),
    ),
    const SizedBox(height: KalloSpacing.sp2),
    SheetOutlineButton(
      icon: LucideIcons.image300,
      label: 'logging.labelScan.choosePhoto'.tr(),
      onTap: () => onPick(ImageSource.gallery),
    ),
    if (isManualNutritionEntryOffered) ...[
      const SizedBox(height: KalloSpacing.sp2),
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
    ClipRRect(
      borderRadius: BorderRadius.circular(KalloRadii.containerLg),
      child: AspectRatio(
        aspectRatio: 3 / 4,
        child: Image.file(
          File(held.path),
          fit: BoxFit.cover,
          // The picker wrote this file moments ago; if it has vanished the
          // useful move is to shoot another, not to crash the sheet.
          errorBuilder:
              (context, _, __) => Container(
                color: KalloColors.track,
                alignment: Alignment.center,
                child: const Icon(
                  LucideIcons.imageOff300,
                  size: 24,
                  color: KalloColors.textMuted,
                ),
              ),
        ),
      ),
    ),
    const SizedBox(height: KalloSpacing.sp3),
    SheetPrimaryButton(
      label: 'logging.labelScan.scanPhoto'.tr(),
      busy: scanning,
      onTap: onScan,
    ),
    const SizedBox(height: KalloSpacing.sp2),
    if (!scanning)
      Center(
        child: QuietIconButton(
          icon: LucideIcons.rotateCcw300,
          label: 'logging.labelScan.retake'.tr(),
          onTap: onRetake,
        ),
      ),
  ];
}
