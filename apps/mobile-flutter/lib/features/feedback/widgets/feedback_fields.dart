import 'dart:io' show File;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show HapticFeedback;
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_motion.dart';
import '../../../theme/kallo_theme.dart';

/// One answer to "What's this about?" — the value posted to the API and the
/// Lucide 300 glyph that stands for it.
class FeedbackType {
  const FeedbackType(this.value, this.icon);
  final String value;
  final IconData icon;
}

const kFeedbackTypes = <FeedbackType>[
  FeedbackType('bug', LucideIcons.bug300),
  FeedbackType('ingredient', LucideIcons.sprout300),
  FeedbackType('idea', LucideIcons.lightbulb300),
];

/// One segment of the type selector.
///
/// NOT [OptionStrip.segmented]: that skin draws labels only — [SegmentedStrip]
/// never reads `OptionStripItem.icon` — and the three feedback kinds are told
/// apart by their glyph as much as by their word. So it stays a chip, cut to
/// the app's chip idiom: the [KalloColors.hover] wash marks the selection, a
/// deeper wash marks the press, colour carries the state and the label keeps
/// its regular weight throughout.
class FeedbackTypeChip extends StatefulWidget {
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
  State<FeedbackTypeChip> createState() => _FeedbackTypeChipState();
}

class _FeedbackTypeChipState extends State<FeedbackTypeChip> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final label = tr('settings.feedback.types.${widget.type.value}');
    final on = widget.selected;
    return Semantics(
      button: true,
      selected: on,
      label: label,
      excludeSemantics: true,
      onTap: widget.onTap,
      child: GestureDetector(
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: () {
          HapticFeedback.selectionClick();
          widget.onTap();
        },
        child: AnimatedContainer(
          duration: KalloMotion.press,
          curve: KalloEase.press,
          padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp3),
          decoration: BoxDecoration(
            color: on
                ? KalloColors.hover
                : (_pressed ? KalloColors.hover40 : KalloColors.elev),
            borderRadius: BorderRadius.circular(KalloRadii.xxxl),
            border: Border.all(
              color: on ? KalloColors.accent60 : KalloColors.borderSoft,
            ),
          ),
          child: Column(
            children: [
              Icon(widget.type.icon, size: 18, color: on ? kInk : kInkMuted),
              const SizedBox(height: 6),
              Text(label, style: dashMeta(color: on ? kInk : kInkMuted)),
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
                  child: Icon(LucideIcons.x300, size: 16, color: kInkMuted),
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
