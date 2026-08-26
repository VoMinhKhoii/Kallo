import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// The user's meal, as a sent chat message.
///
/// Mounted the instant they hit send and kept on screen through the reveal, so
/// the analysis reads as a reply to something they said. That persistence is
/// why the reveal card is handed an empty `rawInput` — its own Lora quote would
/// otherwise print the same sentence a second line below this one.
///
/// Umber (`KalloColors.btn`), not the tan accent: this bubble carries running
/// text, and the palette rule is that tan "survives only on non-text moments"
/// and never colours running text. Tan would also fail contrast against white
/// (2.1:1); umber clears AA at 5.9:1.
///
/// **Press and hold to copy.** What the user typed is the only copy of it — the
/// composer clears on send — so a mis-parsed meal previously had to be retyped
/// from scratch to be re-analysed. Long press is the gesture every chat app
/// uses for this, and on iOS it is what a hard press resolves to.
class UserMessageBubble extends StatelessWidget {
  const UserMessageBubble({super.key, required this.text});

  final String text;

  Future<void> _copy(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: text));
    if (!context.mounted) return;
    HapticFeedback.selectionClick();
    showTopToast(context, 'logging.messageCopied'.tr());
  }

  /// Anchor the menu on the bubble itself, so it opens where the finger is
  /// rather than at a screen corner.
  Future<void> _openActions(BuildContext context) async {
    final bubble = context.findRenderObject() as RenderBox?;
    final overlay =
        Overlay.of(context).context.findRenderObject() as RenderBox?;
    if (bubble == null || overlay == null) return;

    // The cue that the press registered — fired before the menu, because the
    // menu's own entrance is what the user sees second.
    HapticFeedback.mediumImpact();

    final picked = await showMenu<bool>(
      context: context,
      position: RelativeRect.fromRect(
        Rect.fromPoints(
          bubble.localToGlobal(Offset.zero, ancestor: overlay),
          bubble.localToGlobal(
            bubble.size.bottomRight(Offset.zero),
            ancestor: overlay,
          ),
        ),
        Offset.zero & overlay.size,
      ),
      items: [
        PopupMenuItem<bool>(
          value: true,
          height: KalloIcons.hit, // 36 — the app's one hit target
          padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Inline with a text run, so the local 16 rather than the
              // stand-alone glyph's 24.
              const Icon(
                LucideIcons.copy300,
                size: 16,
                color: KalloColors.textMuted,
              ),
              const SizedBox(width: KalloSpacing.sp2),
              Text('logging.copyMessage'.tr(), style: dashBody()),
            ],
          ),
        ),
      ],
    );
    if (picked == true && context.mounted) await _copy(context);
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: FractionallySizedBox(
        widthFactor: 0.85,
        alignment: Alignment.centerRight,
        child: Align(
          alignment: Alignment.centerRight,
          child: Semantics(
            // VoiceOver gets the same action without the gesture: a long press
            // is invisible to anyone who cannot discover it by holding.
            onCopy: () => _copy(context),
            child: GestureDetector(
              onLongPress: () => _openActions(context),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: KalloSpacing.sp3_5, // 14
                  vertical: KalloSpacing.sp2_5, // 10
                ),
                decoration: const BoxDecoration(
                  color: KalloColors.btn,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(KalloRadii.xxl), // 18
                    topRight: Radius.circular(KalloRadii.xxl),
                    bottomLeft: Radius.circular(KalloRadii.xxl),
                    // The tightened corner that makes it read as sent.
                    bottomRight: Radius.circular(KalloRadii.sm), // 6
                  ),
                ),
                child: Text(
                  text,
                  style: dashBody(color: KalloColors.bandForeground),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
