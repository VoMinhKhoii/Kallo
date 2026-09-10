import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/menu/kallo_anchored_menu.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../data/logging_providers.dart';
import 'sent_bubble.dart';

enum _Action { copy, edit }

/// The user's meal, as a sent chat message.
///
/// Mounted the instant they hit send and kept on screen through the reveal, so
/// the analysis reads as a reply to something they said. That persistence is
/// why the reveal card is handed an empty `rawInput` — its own Lora quote would
/// otherwise print the same sentence a line below this one.
///
/// Beige (`KalloColors.btnPrimarySoft`) with INK text — the same wash that
/// marks every in-app primary, a selected choice and the confirm circle, so a
/// sent message reads as "mine" in the app's one warm colour rather than in a
/// colour used nowhere else. It replaced solid umber with white text (native
/// pass, 2026-08-31): a dark block was the heaviest thing on a page of white
/// cards, and the umber tier is now toggles and progress fills only. Ink on
/// #F0EAE0 clears AA at 13:1.
///
/// **Press and hold for Copy and Edit.** What the user typed is the only copy
/// of it — the composer clears on send — so a mis-parsed meal previously had to
/// be retyped from scratch to be re-analysed. Long press is the gesture every
/// chat app uses for this.
///
/// Edit is the one that actually answers that: it puts the message back in the
/// composer, focused, for the user to fix and send again. Copy was standing in
/// for it — the clipboard was the only way back to your own words — and stays
/// because pasting them somewhere else is a different job. Edit does NOT
/// re-run the analysis: the whole point is to change the sentence first.
/// It goes through [composerRefillProvider] rather than a drilled callback
/// because this bubble renders in three meal cards and the live turn's footer,
/// none of which can see the composer's controller.
///
/// **The menu is the app's own** ([showKalloAnchoredMenu]), not
/// `CupertinoContextMenu` — which is what shipped here until 2026-09-08. The
/// system route relocates the pressed widget into a preview slot of its own
/// and scales it 1.15x, so the bubble slid out from under the finger every
/// time; it also hands the actions Cupertino's chrome instead of Be Vietnam
/// Pro, and stretches the hold to iOS's 800ms preview timeout. The owned menu
/// is the ChatGPT behaviour: the bubble does not move (a pinned copy is drawn
/// at the rect the [GlobalKey] measured), the card hangs off its trailing
/// edge, the header says when it was sent, and the hold is Material's 500ms.
/// The exception is recorded under boundary 3 of *Cupertino wherever it
/// exists* in `.agents/skills/kallo-design/mobile.md`.
///
/// The action glyphs come from Lucide, the one icon font this app bundles.
/// `CupertinoIcons.doc_on_clipboard` sat here until 2026-09-05 and painted as
/// a tofu box: its font ships in the `cupertino_icons` package, which is not a
/// dependency (nothing but `test/theme/icon_font_test.dart` can catch that —
/// `flutter/cupertino.dart` declares the glyph either way).
class UserMessageBubble extends ConsumerStatefulWidget {
  const UserMessageBubble({super.key, required this.text, this.sentAt});

  final String text;

  /// When the message was sent, already formatted for the locale by whoever
  /// was printing it anyway (the divider above, the footer's own line). Null
  /// where nothing knows: the menu then opens without its header.
  final String? sentAt;

  @override
  ConsumerState<UserMessageBubble> createState() => _UserMessageBubbleState();
}

class _UserMessageBubbleState extends ConsumerState<UserMessageBubble> {
  /// On the pill, not on this widget: the menu anchors to the BUBBLE's rect,
  /// and this widget's own box is the full-width row it is aligned inside.
  final GlobalKey _pill = GlobalKey();

  /// Park the message for the composer to pick up — the composer applies it
  /// and says what it displaced ([listenForComposerRefill]).
  void _edit() {
    HapticFeedback.selectionClick();
    ref.read(composerRefillProvider.notifier).state = widget.text;
  }

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: widget.text));
    if (!mounted) return;
    HapticFeedback.selectionClick();
    showTopToast(context, 'logging.messageCopied'.tr());
  }

  Future<void> _openMenu(double pageWidth) async {
    final pill = _pill.currentContext?.findRenderObject() as RenderBox?;
    final overlay =
        Overlay.of(context, rootOverlay: true).context.findRenderObject()
            as RenderBox?;
    if (pill == null || overlay == null) return;
    final anchor =
        pill.localToGlobal(Offset.zero, ancestor: overlay) & pill.size;

    final action = await showKalloAnchoredMenu<_Action>(
      context,
      anchor: anchor,
      header: widget.sentAt,
      // The still copy, floated over the blur at the rect the page's own
      // bubble occupies — which is what lets the page's blur run underneath it
      // without the message itself going soft.
      pinned: SentBubble(text: widget.text, pageWidth: pageWidth),
      actions: [
        KalloMenuAction(
          label: 'logging.copyMessage'.tr(),
          icon: LucideIcons.copy300,
          value: _Action.copy,
        ),
        KalloMenuAction(
          label: 'logging.edit'.tr(),
          icon: LucideIcons.pencil300,
          value: _Action.edit,
        ),
      ],
    );
    if (!mounted) return;
    // Awaiting the menu is what puts these AFTER the route has popped: the
    // copy toast is an OverlayEntry and would otherwise land under the scrim.
    switch (action) {
      case _Action.copy:
        await _copy();
      case _Action.edit:
        _edit();
      case null:
        break;
    }
  }

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerRight,
    child: FractionallySizedBox(
      widthFactor: 0.85,
      alignment: Alignment.centerRight,
      child: Align(
        alignment: Alignment.centerRight,
        // The width the page allows the bubble, read ABOVE the menu so the
        // pinned copy in the overlay — where nothing else knows it — wraps
        // where the page wrapped. [SentBubble] explains what it buys.
        child: LayoutBuilder(
          builder: (context, page) => Semantics(
            // VoiceOver gets the same actions without the gesture: a long
            // press is invisible to anyone who cannot discover it by holding.
            // Copy has a standard semantic action; Edit does not, so it goes
            // through the custom-action list the rotor reads out.
            onCopy: _copy,
            customSemanticsActions: {
              CustomSemanticsAction(label: 'logging.edit'.tr()): _edit,
            },
            child: GestureDetector(
              // Opaque: the whole pill answers the hold, not just the glyph
              // run of text under the finger.
              behavior: HitTestBehavior.opaque,
              onLongPress: () => _openMenu(page.maxWidth),
              child: SentBubble(
                key: _pill,
                text: widget.text,
                pageWidth: page.maxWidth,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
