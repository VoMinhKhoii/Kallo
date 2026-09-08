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
///
/// This file is the API and the route only; the open menu's geometry — the
/// blur, the pinned copy, the flip and the clamps — lives in
/// `anchored_menu_layer.dart`.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/kallo_motion.dart';
import 'anchored_menu_layer.dart';
import 'kallo_menu_card.dart';

/// The edge the card shares with its anchor. Re-exported from the file whose
/// geometry reads it so a caller imports the menu and not the menu's insides.
export 'anchored_menu_layer.dart' show KalloMenuEdge;

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

/// Shows [actions] anchored to [anchor] (a GLOBAL rect in the root overlay's
/// coordinates). Resolves with the chosen value, or null on dismiss.
///
/// [header] prints one muted line above the rows — the message's time, for the
/// sent-message menu. [pinned] is drawn at EXACTLY [anchor], unscaled and
/// unshadowed, so a caller can float a crisp copy of the thing it anchored to
/// above the blur without moving it by a pixel. [edge] picks which vertical
/// edge the card shares with the anchor: [KalloMenuEdge.trailing] hangs it off
/// the trailing edge (the default), [KalloMenuEdge.leading] off the leading
/// one.
Future<T?> showKalloAnchoredMenu<T>(
  BuildContext context, {
  required Rect anchor,
  required List<KalloMenuAction<T>> actions,
  String? header,
  Widget? pinned,
  KalloMenuEdge edge = KalloMenuEdge.trailing,
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
    transitionBuilder: (dialogContext, animation, _, __) => AnchoredMenuLayer(
      anchor: anchor,
      overlaySize: overlaySize,
      animation: animation,
      edge: edge,
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
