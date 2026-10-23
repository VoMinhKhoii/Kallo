import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../../shared/widgets/form/kallo_text_field.dart';
import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_theme.dart';

/// The add sheet's search pill, under its header: a 52pt full-round
/// [KalloTextField] with a magnifier and, once there is a query, a clear
/// button in a 44pt target.
///
/// It sits at the top now (approved canvas, E2): the add sheet is a full-height
/// page of results read top-down, closest match first, and the meal it feeds
/// lives on the sheet underneath instead of sharing this one.
class ManualSearchField extends StatelessWidget {
  const ManualSearchField({
    super.key,
    required this.controller,
    this.autofocus = false,
  });

  final TextEditingController controller;

  /// True on the sheet's first open only; coming back from a food page leaves
  /// the keyboard down so the "added" row is visible.
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder:
          (context, value, _) => KalloTextField(
            controller: controller,
            autofocus: autofocus,
            hintText: 'logging.manualLogging.searchPlaceholder'.tr(),
            textInputAction: TextInputAction.search,
            // 18 left inset + 18 glyph + 12 gap = the decoration's 48pt prefix box,
            // so the magnifier lands on the pill's own padding line. The glyph
            // moved 20 → the tertiary tier (Threads icon tiers, 2026-09-01) and
            // the gap absorbed the 2pt, keeping the 48 intact.
            prefixIcon: Padding(
              padding: const EdgeInsets.only(left: 18, right: 12),
              child: Icon(
                LucideIcons.search300,
                size: KalloIcons.tertiary,
                color: kInkMuted,
              ),
            ),
            suffixIcon:
                value.text.isEmpty
                    ? null
                    : IconButton(
                      onPressed: controller.clear,
                      icon: const Icon(
                        LucideIcons.x300,
                        size: KalloIcons.tertiary,
                      ),
                      color: kInkMuted,
                      tooltip: 'logging.manualLogging.clearSearch'.tr(),
                    ),
          ),
    );
  }
}
