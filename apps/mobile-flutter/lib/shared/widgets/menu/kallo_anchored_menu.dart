/// The app's ONE popup menu: a light card that hangs off the rect it was
/// opened from, over a blurred page.
///
/// **Why the app owns this** (2026-09-08). The sent-message menu was
/// `CupertinoContextMenu`, and the system route does two things no anchored
/// menu may do: it MOVES the pressed thing into a preview slot of its own and
/// SCALES it 1.15x, so the bubble visibly drifts out from under the finger,
/// and it dresses the rows in system chrome rather than the app's type.
/// ChatGPT's menu is the reference: the message stays exactly where it was,
/// the menu arrives beside it, the header says when it was sent. Recorded as a
/// documented exception to *Cupertino wherever it exists* under boundary 3, "a
/// widget the app already owns beats both" (`kallo-design/mobile.md`).
///
/// Promoted out of `circle_add_menu.dart`, which had shipped this exact route
/// — measured anchor rect, `showGeneralDialog`, fade + scale out of the
/// aligned corner — for the Circle header's "+". Both call this file now. The
/// caller measures its own rect in the ROOT OVERLAY's coordinates and hands it
/// over; nothing here reaches into the caller's tree.
library;

import 'dart:ui';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/kallo_motion.dart';
import '../../../theme/kallo_theme.dart';
import 'kallo_menu_card.dart';

/// One choice in a [showKalloAnchoredMenu] card: what it says, the Lucide
/// glyph that confirms it, and the value the menu resolves with when picked.
class KalloMenuAction<T> {
  const KalloMenuAction({
    required this.label,
    required this.icon,
    required this.value,
  });

  final String label;
  final IconData icon;
  final T value;
}

/// The scrim under the blur — ink at 20%, well short of the dialog scrim's
/// black/50, and INK rather than pure black so the blurred canvas keeps its
/// hue (`kallo_colors.dart`: a ramp fading toward the wrong neutral is a
/// visible seam). A menu is an extension of the page it hangs off, so that
/// page stays readable; a dialog is not, and dims it properly. The value
/// `circle_add_menu.dart` shipped.
const Color _menuScrim = Color(0x33141413);

const double _menuBlur = 8; // how far the page recedes behind the card

/// Shows [actions] anchored to [anchor] (a GLOBAL rect in the root overlay's
/// coordinates). Resolves with the chosen value, or null on dismiss.
///
/// [header] prints one muted line above the rows — the message's time, for the
/// sent-message menu. [pinned] is drawn at EXACTLY [anchor], unscaled and
/// unshadowed, so a caller can float a crisp copy of the thing it anchored to
/// above the blur without moving it by a pixel. [align] picks which vertical
/// edge the card shares with the anchor: [Alignment.topRight] hangs it off the
/// trailing edge (the default), [Alignment.topLeft] off the leading one.
Future<T?> showKalloAnchoredMenu<T>(
  BuildContext context, {
  required Rect anchor,
  required List<KalloMenuAction<T>> actions,
  String? header,
  Widget? pinned,
  Alignment align = Alignment.topRight,
}) {
  HapticFeedback.lightImpact(); // open cue, as everywhere else
  final overlay = Overlay.of(context, rootOverlay: true);
  final overlayBox = overlay.context.findRenderObject() as RenderBox?;
  final overlaySize = overlayBox?.size ?? MediaQuery.sizeOf(context);

  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: true,
    barrierLabel: tr('common.close'),
    // The route's own barrier stays clear: the dim is painted by the blur
    // layer below, which has to be the same widget that blurs so the two fade
    // in together. The barrier is still there, and still takes the tap.
    barrierColor: const Color(0x00000000),
    transitionDuration: KalloMotion.quick,
    pageBuilder: (_, __, ___) => const SizedBox.shrink(),
    transitionBuilder: (dialogContext, animation, _, __) => _AnchoredMenu(
      anchor: anchor,
      overlaySize: overlaySize,
      animation: animation,
      align: align,
      header: header,
      pinned: pinned,
      rows: [
        for (final action in actions)
          KalloMenuActionRow(
            label: action.label,
            icon: action.icon,
            onTap: () => Navigator.of(dialogContext).pop(action.value),
          ),
      ],
    ),
  );
}

/// The open menu: blur + scrim, the caller's pinned copy at its own rect, and
/// the card growing out of the anchor's corner.
class _AnchoredMenu extends StatelessWidget {
  const _AnchoredMenu({
    required this.anchor,
    required this.overlaySize,
    required this.animation,
    required this.align,
    required this.rows,
    this.header,
    this.pinned,
  });

  final Rect anchor;
  final Size overlaySize;
  final Animation<double> animation;
  final Alignment align;
  final List<KalloMenuActionRow> rows;
  final String? header;
  final Widget? pinned;

  @override
  Widget build(BuildContext context) {
    final curved = CurvedAnimation(
      parent: animation,
      curve: KalloEase.enter,
      reverseCurve: KalloEase.exit,
    );
    final height = kalloMenuCardHeight(
      rows: rows.length,
      header: header != null,
    );
    // Below the anchor unless the card would run off the bottom — then above
    // it, same gap, same edge. The safe inset counts: a card ending under the
    // home indicator has a last row nobody can tap.
    final floor = overlaySize.height - MediaQuery.paddingOf(context).bottom;
    final flipped = anchor.bottom + KalloSpacing.sp2 + height > floor;
    final top = flipped
        ? anchor.top - KalloSpacing.sp2 - height
        : anchor.bottom + KalloSpacing.sp2;

    final leftEdge = align == Alignment.topLeft;
    final wanted = leftEdge ? anchor.left : anchor.right - kKalloMenuWidth;
    final maxLeft = overlaySize.width - kKalloMenuWidth - KalloSpacing.sp3;
    final left = maxLeft <= KalloSpacing.sp3
        ? KalloSpacing.sp3
        : wanted.clamp(KalloSpacing.sp3, maxLeft);

    return Stack(
      children: [
        // Decorative only — IgnorePointer so the dismiss tap reaches the
        // route's barrier underneath rather than dying on the scrim.
        Positioned.fill(
          child: IgnorePointer(
            child: FadeTransition(
              opacity: curved,
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: _menuBlur, sigmaY: _menuBlur),
                child: const ColoredBox(color: _menuScrim),
              ),
            ),
          ),
        ),
        if (pinned != null)
          Positioned.fromRect(
            rect: anchor,
            child: IgnorePointer(child: pinned!),
          ),
        Positioned(
          left: left,
          top: top,
          width: kKalloMenuWidth,
          child: FadeTransition(
            opacity: curved,
            child: ScaleTransition(
              scale: Tween<double>(begin: 0.92, end: 1).animate(curved),
              alignment: flipped
                  ? (leftEdge ? Alignment.bottomLeft : Alignment.bottomRight)
                  : (leftEdge ? Alignment.topLeft : Alignment.topRight),
              // The overlay sits above every Material in the app, and nothing
              // below here introduces one — without this the row labels fall
              // back to the framework's debug style (red monospace on a double
              // YELLOW underline). Transparent restores the inherited text
              // style without painting over the card's surface or shadow.
              child: Material(
                type: MaterialType.transparency,
                child: KalloMenuCard(rows: rows, header: header),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
