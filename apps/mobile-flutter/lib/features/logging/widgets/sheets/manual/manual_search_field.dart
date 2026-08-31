import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../shared/widgets/form/kallo_text_field.dart';
import '../../../../../theme/calm_tokens.dart';

/// The search pill at the VERY BOTTOM of the manual-log sheet (native pass,
/// 2026-08-31): a 52pt full-round [KalloTextField] with a 20pt magnifier and,
/// once there is a query, a clear button in a 44pt target.
///
/// Bottom placement is the point of the layout — the field is under the thumb
/// and the results grow up toward it, so adding a fifth ingredient never means
/// reaching for the top of the screen.
class ManualSearchField extends StatelessWidget {
  const ManualSearchField({super.key, required this.controller});

  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) => KalloTextField(
        controller: controller,
        autofocus: true,
        hintText: 'logging.manualLogging.searchPlaceholder'.tr(),
        textInputAction: TextInputAction.search,
        // 18 left inset + 20 glyph + 10 gap = the decoration's 48pt prefix box,
        // so the magnifier lands on the pill's own padding line.
        prefixIcon: const Padding(
          padding: EdgeInsets.only(left: 18, right: 10),
          child: Icon(LucideIcons.search300, size: 20, color: kInkMuted),
        ),
        suffixIcon: value.text.isEmpty
            ? null
            : IconButton(
                onPressed: controller.clear,
                icon: const Icon(LucideIcons.x300, size: 20),
                color: kInkMuted,
                tooltip: 'logging.manualLogging.clearSearch'.tr(),
              ),
      ),
    );
  }
}
