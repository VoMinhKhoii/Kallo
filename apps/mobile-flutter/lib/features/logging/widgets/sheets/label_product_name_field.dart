import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import 'label_field_chrome.dart';

/// What the meal will be called once it is logged.
///
/// A line of type on a hairline, not a boxed input: on a sheet whose job is
/// "check these numbers", the name is context, and boxing it gave it the same
/// weight as the figures.
class LabelProductNameField extends StatefulWidget {
  const LabelProductNameField({
    super.key,
    required this.controller,
    required this.isValid,
    required this.enabled,
    required this.onChanged,
  });

  final TextEditingController controller;
  final bool isValid;
  final bool enabled;
  final ValueChanged<String> onChanged;

  @override
  State<LabelProductNameField> createState() => _LabelProductNameFieldState();
}

class _LabelProductNameFieldState extends State<LabelProductNameField> {
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('logging.labelScan.productName'.tr(), style: dashMeta()),
        const SizedBox(height: NhamSpacing.sp1),
        TextField(
          controller: widget.controller,
          focusNode: _focus,
          enabled: widget.enabled,
          onChanged: widget.onChanged,
          cursorColor: NhamColors.accent,
          style: dashBody(weight: FontWeight.w500),
          decoration: labelFieldDecoration(),
        ),
        const SizedBox(height: NhamSpacing.sp1),
        LabelFieldRule(hasError: !widget.isValid, focused: _focus.hasFocus),
        if (!widget.isValid) ...[
          const SizedBox(height: NhamSpacing.sp1),
          Text(
            'logging.labelScan.invalidProductName'.tr(),
            style: dashMeta(color: NhamColors.danger),
          ),
        ],
      ],
    );
  }
}
