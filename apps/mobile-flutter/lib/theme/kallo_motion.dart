/// The app's motion tokens — durations and curves named by ROLE.
///
/// The palette, the type scale and the spacing rhythm all resolve to a small
/// named set; motion did not. It was 125 inline `Duration(milliseconds: N)`
/// literals across 34 distinct values, so "how long does a press take" had no
/// answer you could look up and no single place to change. The distribution was
/// already bimodal — 46 sites at 150 and 15 at 200 — which is the shape of a
/// system that exists but was never written down.
///
/// Name the role, not the number: a caller asking for [press] keeps working
/// when 150 turns out to be 140, and a reviewer can tell a considered duration
/// from a typed one.
library;

import 'package:flutter/animation.dart';

abstract final class KalloMotion {
  // ── Durations ─────────────────────────────────────────────────────────

  /// A correction the eye should not perceive as travel — re-pinning a
  /// scrolled tail, closing a gap a layout change just opened.
  static const Duration instant = Duration(milliseconds: 100);

  /// Every tap affordance: the scale dip and the press wash. The app's most
  /// common duration by a wide margin.
  static const Duration press = Duration(milliseconds: 150);

  /// A small state change in place — a chevron turning, a wash crossfading.
  static const Duration quick = Duration(milliseconds: 200);

  /// A control changing shape: a field taking focus, a card expanding.
  static const Duration emphasis = Duration(milliseconds: 300);

  /// Something arriving on screen for the first time.
  static const Duration entrance = Duration(milliseconds: 350);

  /// The date chip crossfading into the week strip and back.
  static const Duration morph = Duration(milliseconds: 340);

  /// One week of the strip paging under a swipe or a chevron.
  static const Duration page = Duration(milliseconds: 280);

  /// A deliberate journey down the feed to a new answer.
  static const Duration scrollTo = Duration(milliseconds: 400);

  /// The nav drawer coming in, and going back out slightly faster.
  ///
  /// These deliberately DIVERGE from the web sheet (`components/ui/sheet.tsx`,
  /// 500/300 ease-in-out) that the drawer was otherwise ported from 1:1. Half a
  /// second is roughly twice Material's own drawer, and on a phone it reads as
  /// lag even when every frame lands — the web sheet is a pointer-driven
  /// surface where the longer travel reads as deliberate instead. Closing is
  /// quicker than opening because a dismissal should feel like getting out of
  /// the way, not like a second animation to sit through.
  static const Duration drawerOpen = Duration(milliseconds: 280);
  static const Duration drawerClose = Duration(milliseconds: 220);

  /// How long a passive toast sits before it withdraws.
  static const Duration toast = Duration(milliseconds: 2200);

  /// The grace period on anything destructive — long enough to notice and
  /// reach, short enough that the feed is not lying about its contents.
  static const Duration undoWindow = Duration(seconds: 5);

  /// Between one item of a staggered entrance and the next.
  static const Duration stagger = Duration(milliseconds: 50);

}

/// The curves those durations run on. A separate class so a duration and a
/// curve can share a role name — `KalloMotion.press` and `KalloEase.press`.
abstract final class KalloEase {
  /// Press affordances: leave immediately, settle softly.
  static const Curve press = Curves.easeOut;

  /// The default for a change that starts and ends on screen.
  static const Curve standard = Curves.easeInOut;

  /// Something entering: quick off the mark, long settle.
  static const Curve enter = Curves.easeOutCubic;

  /// The app's long decelerating tail, already spelled inline at the feed's
  /// scroll-to and the week pager.
  static const Curve decelerate = Cubic(0.16, 1, 0.3, 1);

  /// Panels that slide in from an edge — Material's own drawer curve, and what
  /// makes [drawerOpen] read as immediate rather than abrupt.
  static const Curve drawer = Curves.fastOutSlowIn;
}
