import 'package:flutter/material.dart';

import '../../../../../models/social/circle.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_motion.dart';
import '../../../../../theme/kallo_theme.dart';
import '../invite_card.dart';

/// How far each peek layer's top edge sits ABOVE the front card's, nearest
/// first. The offers stack downward, so the one you act on is nearest the
/// thumb and the queue behind it recedes toward the section label. Two is the
/// whole ramp: a third stops reading as depth and starts reading as a fringe.
const List<double> _kPeekDrops = [6, 12];

/// How far each layer is inset horizontally, same order.
const List<double> _kPeekInsets = [8, 16];

/// The pending offers as one deck rather than a column.
///
/// There is no cap on how many meals a friend can send and every invite card
/// runs 150–220pt, so a flat list walks the day group off the bottom of the
/// screen. Collapsed to a deck the inbox has ONE height whatever arrives.
///
/// Only the front card is real. You dismiss it or take it and the next rises —
/// there is no browsing affordance, because there is no decision to make about
/// an offer you have not reached yet. The web twin is `invite-deck.tsx`.
///
/// The layers behind it are the SAME card, set back by an inset, a lighter
/// shadow, and a ring in the canvas colour (a zero-blur spread shadow) that
/// cuts each one away from the card in front. Not a second surface colour:
/// there is exactly one card colour in this palette.
class InviteDeck extends StatelessWidget {
  const InviteDeck({required this.invites, super.key});

  final List<MealShareInvite> invites;

  @override
  Widget build(BuildContext context) {
    if (invites.isEmpty) return const SizedBox.shrink();

    // One offer is not a deck. Phantom layers under it would promise something
    // behind that the next tap does not produce.
    final layerCount = (invites.length - 1).clamp(0, _kPeekDrops.length);
    final reach = layerCount == 0 ? 0.0 : _kPeekDrops[layerCount - 1];

    return Stack(
      children: [
        // Furthest first, so the nearer layer paints over it and each ring
        // reads as an edge rather than a seam. Their bottoms sit behind the
        // front card; only the top strip shows.
        for (var i = layerCount - 1; i >= 0; i--)
          Positioned(
            left: _kPeekInsets[i],
            right: _kPeekInsets[i],
            top: reach - _kPeekDrops[i],
            bottom: 0,
            child: const InvitePeekLayer(),
          ),
        // Non-positioned, so it sizes the Stack: card height plus the room the
        // deepest layer needs. Last, so it paints on top.
        Padding(
          padding: EdgeInsets.only(top: reach),
          child: AnimatedSwitcher(
            duration: KalloMotion.disclosure,
            // Both cards are mounted while this runs — AnimatedSwitcher fades
            // the outgoing one out as the next rises. The default layout
            // centres them in a Stack sized to the TALLER, so a split card
            // (which carries a PortionReadout) handing over to a plain copy
            // left the deck tall for 180ms, floated the short card in the
            // middle of it, then snapped. Top-left pins both to the same
            // origin, so only the height settles and it settles downward.
            layoutBuilder:
                (currentChild, previousChildren) => Stack(
                  alignment: Alignment.topLeft,
                  children: <Widget>[
                    ...previousChildren,
                    if (currentChild != null) currentChild,
                  ],
                ),
            transitionBuilder:
                (child, animation) => FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: const Offset(0, -0.04),
                      end: Offset.zero,
                    ).animate(animation),
                    child: child,
                  ),
                ),
            child: InviteCard(
              invite: invites.first,
              key: ValueKey(invites.first.id),
            ),
          ),
        ),
      ],
    );
  }
}

/// An empty card back. Decoration only — nothing to read, nothing to tap.
///
/// Public so a widget test can count the peek without reaching for the shadow
/// values that give it its depth.
class InvitePeekLayer extends StatelessWidget {
  const InvitePeekLayer({super.key});

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Container(
        decoration: BoxDecoration(
          color: KalloColors.elev,
          borderRadius: BorderRadius.circular(KalloRadii.containerLg),
          border: Border.all(color: KalloColors.borderSoft),
          boxShadow: const [
            // Zero blur, 1pt spread, canvas colour: a hairline gap that
            // separates this layer from the card sitting on top of it.
            BoxShadow(color: KalloColors.surface, spreadRadius: 1),
            KalloShadows.xs,
          ],
        ),
      ),
    );
  }
}
