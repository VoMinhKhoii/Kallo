import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';

import '../../../../../shared/widgets/sheet/kallo_sheet_sub_header.dart';
import '../../../../../shared/widgets/sheet/sheet_capsule_button.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_motion.dart';
import '../../../../../theme/kallo_theme.dart';

/// The group sheet's rename level: one field and a "Save" capsule.
///
/// It replaced an inline field that swapped in for the sheet's title — a text
/// box squeezed between the close circle and a tick button, with the keyboard
/// arriving under a sheet that had not been built for one. A second level
/// gives the field the full width and the header its usual shape.
class GroupRenamePage extends StatefulWidget {
  const GroupRenamePage({
    required this.controller,
    required this.busy,
    required this.onBack,
    required this.onSave,
    required this.isOpen,
    super.key,
  });

  /// Lives in the sheet: `SheetPageSwap` rebuilds the page on every swap.
  final TextEditingController controller;
  final bool busy;
  final VoidCallback onBack;
  final VoidCallback onSave;

  /// Whether the sheet is still on this level, asked when the field is about
  /// to focus. `SheetPageSwap` also builds a fresh copy of the page to slide
  /// OUT on Back, and that copy must not raise the keyboard on its way off.
  final bool Function() isOpen;

  static const int maxLength = 60;

  @override
  State<GroupRenamePage> createState() => _GroupRenamePageState();
}

class _GroupRenamePageState extends State<GroupRenamePage> {
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    // Focus once the page has slid in: a keyboard rising DURING the slide
    // resizes the sheet under it every frame.
    Future.delayed(KalloMotion.page, () {
      if (mounted && widget.isOpen()) _focus.requestFocus();
    });
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final GroupRenamePage(:controller, :busy, :onBack, :onSave) = widget;
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) {
        final canSave = !busy && value.text.trim().isNotEmpty;
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            KalloSheetSubHeader(
              title: tr('groups.info.renameLabel'),
              onBack: onBack,
              trailing: SheetCapsuleButton(
                label: tr('groups.info.renameSave'),
                onTap: canSave ? onSave : null,
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                KalloSpacing.sp4,
                KalloSpacing.sp2,
                KalloSpacing.sp4,
                KalloSpacing.sp6 + MediaQuery.paddingOf(context).bottom,
              ),
              child: CupertinoTextField(
                controller: controller,
                focusNode: _focus,
                maxLength: GroupRenamePage.maxLength,
                textCapitalization: TextCapitalization.sentences,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => canSave ? onSave() : null,
                style: dashBody(),
                cursorColor: kInk,
                padding: const EdgeInsets.symmetric(
                  horizontal: KalloSpacing.sp4,
                  vertical: KalloSpacing.sp3_5,
                ),
                // `CupertinoTextField` takes a BoxDecoration only, so the
                // card's squircle is approximated by its rounded rect.
                decoration: const BoxDecoration(
                  color: kCardSurface,
                  borderRadius: BorderRadius.all(
                    Radius.circular(KalloRadii.containerLg),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
