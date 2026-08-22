import 'package:flutter/material.dart';

import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_colors.dart';

/// The caption above a [LabelField]: an optional macro glyph, the nutrient's
/// name, and the required mark that replaced the sentence under the button.
class LabelFieldLabel extends StatelessWidget {
  const LabelFieldLabel({
    super.key,
    required this.text,
    this.icon,
    this.iconColor,
    this.isRequired = false,
  });

  final String text;
  final IconData? icon;
  final Color? iconColor;
  final bool isRequired;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (icon != null) ...[
          Icon(icon, size: 14, color: iconColor),
          const SizedBox(width: 5),
        ],
        Flexible(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: dashMeta(),
          ),
        ),
        if (isRequired) Text(' *', style: dashMeta(color: KalloColors.danger)),
      ],
    );
  }
}
