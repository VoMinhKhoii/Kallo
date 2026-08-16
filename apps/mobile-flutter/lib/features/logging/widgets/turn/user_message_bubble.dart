import 'package:flutter/widgets.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';

/// The user's meal, as a sent chat message.
///
/// Mounted the instant they hit send and kept on screen through the reveal, so
/// the analysis reads as a reply to something they said. That persistence is
/// why the reveal card is handed an empty `rawInput` — its own Lora quote would
/// otherwise print the same sentence a second line below this one.
///
/// Umber (`NhamColors.btn`), not the tan accent: this bubble carries running
/// text, and the palette rule is that tan "survives only on non-text moments"
/// and never colours running text. Tan would also fail contrast against white
/// (2.1:1); umber clears AA at 5.9:1.
class UserMessageBubble extends StatelessWidget {
  const UserMessageBubble({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: FractionallySizedBox(
        widthFactor: 0.85,
        alignment: Alignment.centerRight,
        child: Align(
          alignment: Alignment.centerRight,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: NhamSpacing.sp3_5, // 14
              vertical: NhamSpacing.sp2_5, // 10
            ),
            decoration: const BoxDecoration(
              color: NhamColors.btn,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(NhamRadii.xxl), // 18
                topRight: Radius.circular(NhamRadii.xxl),
                bottomLeft: Radius.circular(NhamRadii.xxl),
                // The tightened corner that makes it read as sent, not received.
                bottomRight: Radius.circular(NhamRadii.sm), // 6
              ),
            ),
            child: Text(
              text,
              style: dashBody(color: NhamColors.bandForeground),
            ),
          ),
        ),
      ),
    );
  }
}
