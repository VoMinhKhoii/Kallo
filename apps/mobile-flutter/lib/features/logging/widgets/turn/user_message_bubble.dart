import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
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
/// Beige (`KalloColors.btnPrimarySoft`) with INK text — the same wash that
/// marks every in-app primary, a selected choice and the confirm circle, so a
/// sent message reads as "mine" in the app's one warm colour rather than in a
/// colour used nowhere else. It replaced solid umber with white text (native
/// pass, 2026-08-31): a dark block was the heaviest thing on a page of white
/// cards, and the umber tier is now toggles and progress fills only. Ink on
/// #F0EAE0 clears AA at 13:1.
///
/// **Press and hold to copy.** What the user typed is the only copy of it — the
/// composer clears on send — so a mis-parsed meal previously had to be retyped
/// from scratch to be re-analysed. Long press is the gesture every chat app
/// uses for this, and on iOS it is what a hard press resolves to.
///
/// The menu is [CupertinoContextMenu], not Material's `showMenu`. `showMenu`
/// dropped a flat card ON TOP of the bubble with no backdrop, no lift and no
/// entrance — next to the system menu every other chat app gets for free, it
/// read as unfinished. The Cupertino route blurs the page behind it, dims it,
/// floats the bubble above the blur at 1.15x and slides the actions in
/// beneath, which is the whole reason to prefer it over anything hand-rolled.
///
/// Two consequences worth knowing: the hold is 800ms (iOS's own
/// `_previewLongPressTimeout`, not Material's 500), and the action rows carry
/// Cupertino's chrome rather than Be Vietnam Pro — the accepted cost of the
/// system menu. The bubble keeps its own decoration, so it lifts as itself —
/// though only up to the point the route opens: `_defaultPreviewBuilder` wraps
/// the preview in a `ClipRSuperellipse` at a flat 12, which is squarer than
/// our 18 (so the three round corners are untouched) but rounder than the
/// tightened 4, which is therefore softened to 12 for as long as the menu is
/// open. Getting that one corner back means giving up the default preview
/// builder — and its shadow and scale — for `CupertinoContextMenu.builder`;
/// not worth it for a corner nobody sees except beside its own page.
///
/// Two things the menu got wrong until 2026-09-05, both of which made the
/// screenshot read as unfinished next to the system menu every other chat app
/// gets for free:
///
/// 1. **The lift is drawn outside every Material.** `CupertinoContextMenu`
///    re-renders this widget in the root overlay (the decoy) and again inside
///    its own route (the preview), and both sit above the app's Materials.
///    What is left up there is `MaterialApp`'s fallback `DefaultTextStyle` —
///    the one whose debugLabel reads "consider putting your text in a
///    Material" — and it carries a **yellow double underline**. [dashBody]
///    merges onto it (`TextStyle.inherit` defaults to true) and overrides
///    colour, size and family but never `decoration`, so the underline
///    survived and painted under the lifted message. A transparent [Material]
///    installs a real `DefaultTextStyle` and adds no pixels of its own —
///    the same fix, for the same reason, as `TopToastPill`.
/// 2. **The action glyph was from a font we do not ship.**
///    `CupertinoIcons.doc_on_clipboard` needs the `cupertino_icons` package,
///    which is not a dependency of this app, so it painted as a tofu box.
///    Lucide is the one icon font bundled here and the only set AGENTS.md
///    allows: [LucideIcons.copy300], the same copy glyph Circle's entry
///    actions and the invite row already use, at the app-wide 300 stroke.
class UserMessageBubble extends StatelessWidget {
  const UserMessageBubble({super.key, required this.text});

  final String text;

  Future<void> _copy(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: text));
    if (!context.mounted) return;
    HapticFeedback.selectionClick();
    showTopToast(context, 'logging.messageCopied'.tr());
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
            child: CupertinoContextMenu(
              // The system route fires its own cue as the preview lifts — a
              // beat earlier, and truer to iOS, than one fired on open.
              enableHapticFeedback: true,
              actions: [
                CupertinoContextMenuAction(
                  trailingIcon: LucideIcons.copy300,
                  onPressed: () async {
                    // Close the route first: the toast is an OverlayEntry and
                    // would otherwise land under the dimming barrier.
                    Navigator.of(context).pop();
                    await _copy(context);
                  },
                  child: Text('logging.copyMessage'.tr()),
                ),
              ],
              // Transparent, so the bubble looks identical in the page and
              // adds nothing to it — it exists only to carry a real
              // DefaultTextStyle into the overlay and the route above.
              child: Material(
                type: MaterialType.transparency,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: KalloSpacing.sp3_5, // 14
                    vertical: KalloSpacing.sp2_5, // 10
                  ),
                  decoration: const BoxDecoration(
                    color: KalloColors.btnPrimarySoft,
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(KalloRadii.xxl), // 18
                      topRight: Radius.circular(KalloRadii.xxl),
                      bottomLeft: Radius.circular(KalloRadii.xxl),
                      // The tightened corner that makes it read as sent.
                      bottomRight: Radius.circular(4),
                    ),
                  ),
                  child: Text(text, style: dashBody()),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
