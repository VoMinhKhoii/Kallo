import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../../theme/kallo_typography.dart';
import '../../data/surface_cast.dart';
import '../brand/surface_illustration.dart';

/// The app's one state surface: illustration → title → subtitle → one action,
/// centred in its own block. Every error, empty, 404 and offline surface is
/// this widget — pass the [area] it stands on and the [kind] it is saying, and
/// the cast picks the pose (and, after 22:00, the sleeping pose).
///
/// Twin of the web `components/shared/surface-state/` (keep in sync).
class KalloSurfaceState extends StatelessWidget {
  const KalloSurfaceState({
    super.key,
    required SurfaceArea this.area,
    required SurfaceKind this.kind,
    required this.title,
    this.subtitle,
    this.action,
    this.compact = false,
    this.minHeight,
    this.now,
  }) : mark = null;

  /// For the one caller that brings its own glyph instead of a cast pose — the
  /// paywall's locked card, whose padlock IS the message.
  const KalloSurfaceState.withMark({
    super.key,
    required Widget this.mark,
    required this.title,
    this.subtitle,
    this.action,
    this.compact = false,
    this.minHeight,
  })  : area = null,
        kind = null,
        now = null;

  /// Which animal. Null only on [KalloSurfaceState.withMark].
  final SurfaceArea? area;

  /// Which pose, and whether this surface is an error (it announces itself).
  final SurfaceKind? kind;

  /// A caller-supplied glyph standing in for the illustration.
  final Widget? mark;

  final String title;

  /// One quiet supporting line — keep it to a sentence.
  final String? subtitle;

  /// The one way forward. Optional: some surfaces have nothing to offer.
  final Widget? action;

  /// In-card sizing: 64pt art and half the gaps, for a state that sits inside
  /// a section rather than owning the screen.
  final bool compact;

  /// The block it centres itself inside. Its OWN space — not the whole page,
  /// which would drift with however much happens to sit above and below it.
  final double? minHeight;

  /// The clock, injectable so a test can stand at 23:00.
  final DateTime Function()? now;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      // An error arrives while the user is looking elsewhere; an empty state is
      // just what the surface looks like.
      liveRegion: kind == SurfaceKind.error,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          minHeight: minHeight ?? (compact ? 140 : 288),
        ),
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: compact ? KalloSpacing.sp4 : KalloSpacing.sp6,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              mark ??
                  SurfaceIllustration(
                    area: area!,
                    kind: kind!,
                    height: compact ? 64 : 120,
                    now: now,
                  ),
              SizedBox(height: compact ? 16 : 24),
              Semantics(
                header: true,
                child: Text(
                  title,
                  textAlign: TextAlign.center,
                  style: KalloTextStyles.serifMedium(
                    fontSize: compact ? 18 : 24,
                  ).copyWith(
                    height: compact ? 24 / 18 : 30 / 24,
                    letterSpacing: compact ? -0.2 : -0.36,
                    color: KalloColors.text,
                  ),
                ),
              ),
              if (subtitle != null) ...[
                SizedBox(height: compact ? 8 : 12),
                // Vietnamese copy is long; cap the measure so it wraps into a
                // block rather than running the full width of a phone.
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 360),
                  child: Text(
                    subtitle!,
                    textAlign: TextAlign.center,
                    // In-card the block is a guest in someone else's section,
                    // and a caller-supplied error message has no length limit:
                    // two lines at 320 × 1.3 is 72pt, three is 108. Clamp the
                    // compact variant so a long message cannot push the action
                    // out of the card. The full-size state owns its screen and
                    // keeps every word.
                    maxLines: compact ? 2 : null,
                    overflow: compact ? TextOverflow.ellipsis : null,
                    style: dashBody(color: kInkMuted).copyWith(height: 28 / 16),
                  ),
                ),
              ],
              if (action != null) ...[
                SizedBox(height: compact ? 16 : 24),
                action!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}
