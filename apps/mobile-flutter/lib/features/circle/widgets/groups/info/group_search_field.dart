import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_theme.dart';

/// The iOS search field: a grey rounded rect, a leading magnifier. Built on
/// `CupertinoTextField` rather than `CupertinoSearchTextField`, whose glyphs
/// come from the `CupertinoIcons` font the app does not ship (mobile.md,
/// the back-button exception) — they would render as missing-glyph boxes.
class GroupSearchField extends StatelessWidget {
  const GroupSearchField({required this.controller, super.key});

  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return CupertinoTextField(
      controller: controller,
      placeholder: tr('groups.info.searchPlaceholder'),
      placeholderStyle: dashBody(color: kInkMuted),
      style: dashBody(),
      cursorColor: kInk,
      padding: const EdgeInsets.symmetric(
        horizontal: KalloSpacing.sp2,
        vertical: KalloSpacing.sp2_5,
      ),
      prefix: const Padding(
        padding: EdgeInsets.only(left: KalloSpacing.sp2_5),
        child: Icon(
          LucideIcons.search300,
          size: KalloIcons.tertiary,
          color: kInkMuted,
        ),
      ),
      decoration: const BoxDecoration(
        color: kTrack,
        borderRadius: BorderRadius.all(Radius.circular(KalloRadii.lg)),
      ),
    );
  }
}
