import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../shared/widgets/form/kallo_text_field.dart';
import '../../../../../shared/widgets/form/sheet_action_buttons.dart';
import '../../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_theme.dart';

/// Type the barcode by hand when the camera cannot read it (or does not
/// exist) — its own surface inside the scan sheet, under an "Enter barcode"
/// title (native pass, 2026-08-31; artboard `BarcodeEntry`).
///
/// A 52pt full-round field over the beige "Look up" primary, and the SYSTEM
/// number pad: `keyboardType` is the whole implementation. A hand-built keypad
/// would lose paste, the delete-repeat, and every accessibility affordance iOS
/// puts on its own.
class BarcodeManualInput extends StatelessWidget {
  const BarcodeManualInput({
    super.key,
    required this.controller,
    required this.onSubmit,
    required this.onBackToCamera,
  });

  final TextEditingController controller;
  final VoidCallback onSubmit;
  final VoidCallback onBackToCamera;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewPaddingOf(context).bottom;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        KalloSpacing.sp4,
        KalloSpacing.sp2,
        KalloSpacing.sp4,
        bottomInset + KalloSpacing.sp2,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KalloTextField(
            controller: controller,
            autofocus: true,
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.search,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onSubmitted: (_) => onSubmit(),
            hintText: 'logging.barcode.placeholder'.tr(),
            prefixIcon: const Padding(
              padding: EdgeInsets.only(left: 18, right: 10),
              child: Icon(
                LucideIcons.scanBarcode300,
                size: 20,
                color: kInkMuted,
              ),
            ),
          ),
          const SizedBox(height: KalloSpacing.sp3),
          KalloButton(
            title: 'logging.barcode.lookUp'.tr(),
            onPressed: onSubmit,
          ),
          const SizedBox(height: KalloSpacing.sp1),
          Center(
            child: QuietIconButton(
              icon: LucideIcons.camera300,
              label: 'logging.barcode.backToCamera'.tr(),
              onTap: onBackToCamera,
            ),
          ),
        ],
      ),
    );
  }
}
