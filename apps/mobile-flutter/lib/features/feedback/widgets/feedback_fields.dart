import 'dart:io' show File;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../screens/feedback_screen.dart' show FeedbackType;

class FeedbackTypeChip extends StatelessWidget {
  const FeedbackTypeChip({
    super.key,
    required this.type,
    required this.selected,
    required this.onTap,
  });

  final FeedbackType type;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: tr('settings.feedback.types.${type.value}'),
      excludeSemantics: true,
      onTap: onTap,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp3),
          decoration: BoxDecoration(
            color: selected
                ? KalloColors.hover
                : KalloColors.elev,
            borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
            border: Border.all(
              color: selected ? kInk.withValues(alpha: 0.3) : KalloColors.borderSoft,
            ),
          ),
          child: Column(
            children: [
              Icon(
                type.icon,
                size: 18,
                color: selected ? kInk : kInkMuted,
              ),
              const SizedBox(height: 6),
              Text(
                tr('settings.feedback.types.${type.value}'),
                style: dashMeta(
                  color: selected ? kInk : kInkMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class FeedbackScreenshotField extends StatelessWidget {
  const FeedbackScreenshotField({
    super.key,
    required this.file,
    required this.onAdd,
    required this.onRemove,
  });

  final XFile? file;
  final VoidCallback? onAdd;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final selected = file;
    if (selected != null) {
      return Container(
        padding: const EdgeInsets.symmetric(
          horizontal: KalloSpacing.sp3,
          vertical: 10,
        ),
        decoration: BoxDecoration(
          color: KalloColors.elev,
          borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
          border: Border.all(color: KalloColors.borderSoft),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(KalloRadii.sm),
              child: Image.file(
                File(selected.path),
                width: 36,
                height: 36,
                fit: BoxFit.cover,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                selected.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: dashBody(),
              ),
            ),
            Semantics(
              button: true,
              label: tr('settings.feedback.removeScreenshot'),
              excludeSemantics: true,
              onTap: onRemove,
              child: GestureDetector(
                onTap: onRemove,
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(
                    LucideIcons.x300,
                    size: 16,
                    color: kInkMuted,
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Semantics(
      button: true,
      label: tr('settings.feedback.addScreenshot'),
      excludeSemantics: true,
      onTap: onAdd,
      child: GestureDetector(
        onTap: onAdd,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: KalloSpacing.sp3,
            vertical: 10,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
            border: Border.all(color: KalloColors.borderSoft),
          ),
          child: Row(
            children: [
              const Icon(
                LucideIcons.imagePlus300,
                size: 16,
                color: kInkMuted,
              ),
              const SizedBox(width: 8),
              Text(
                tr('settings.feedback.addScreenshot'),
                style: dashBody(color: kInkMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
