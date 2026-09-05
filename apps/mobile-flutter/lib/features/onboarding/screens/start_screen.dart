import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/brand/kallo_wordmark.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../shared/widgets/typography/meta_action.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../widgets/start_aurora.dart';

/// The signed-out entry (`/start`).
///
/// The first thing a new install sees: the wordmark on the aurora sweep, a
/// device preview of the Log screen dissolving into the canvas, the promise in
/// one line, and the two ways in — "Get started" runs the wizard BEFORE
/// sign-in (the answers live in a local draft until `/save-plan`), and the
/// quiet link is for the account that already exists.
///
/// Two anchors, not one column: the wordmark and the preview are measured from
/// the top of the SAFE AREA (66 and 132), while the title, the CTA and the
/// link hug the BOTTOM of it. The preview's fade then runs UNDER the title —
/// the promise reads as sitting in the dissolve, not as a caption butted
/// against a card's edge. Only the preview flexes: it is the one block that
/// can lose height without the screen losing meaning, so on a short phone it
/// scales down instead of pushing the CTA off the bottom.
class StartScreen extends StatelessWidget {
  const StartScreen({super.key});

  /// Design metrics, all measured from the top of the safe area.
  static const double _wordmarkTop = 66;
  static const double _wordmarkHeight = 34;
  static const double _previewTop = 132;

  /// The device card, so a layout test can measure what it actually got.
  static const Key previewKey = ValueKey('start-preview');

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KalloColors.surface,
      body: Stack(
        children: [
          const Positioned.fill(child: StartAurora()),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: KalloSpacing.sp6,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: _wordmarkTop),
                  const KalloWordmark(height: _wordmarkHeight),
                  const SizedBox(
                    height: _previewTop - _wordmarkTop - _wordmarkHeight,
                  ),
                  // Everything the buttons do not claim: the preview and the
                  // promise sitting in its dissolve.
                  //
                  // The title is pinned INTO the dissolve — its top sits
                  // [_DevicePreview.titleOverlap] above the card's bottom
                  // edge, which by then is under solid canvas, so the promise
                  // reads as rising out of the fade rather than as a caption
                  // under a picture. Below it comes the design's 24pt of air,
                  // and any height the screen has to spare lands under THAT —
                  // never between the preview and the title, which is the pair
                  // that must stay locked.
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Flexible, not Expanded: the preview takes its natural
                        // height until the leftover is genuinely too short, and
                        // only then gives some up.
                        const Flexible(child: _PreviewBox()),
                        Text(
                          tr('onboarding.start.title'),
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: kPageTitle(),
                        ),
                        const SizedBox(height: KalloSpacing.sp6),
                      ],
                    ),
                  ),
                  KalloButton(
                    title: tr('onboarding.start.cta'),
                    variant: KalloButtonVariant.cta,
                    onPressed: () => context.go('/onboarding'),
                  ),
                  const SizedBox(height: KalloSpacing.sp3),
                  // The quiet way back for an account that already exists.
                  MetaAction(
                    label: tr('onboarding.start.haveAccount'),
                    onTap: () => context.go('/sign-in'),
                  ),
                  const SizedBox(height: KalloSpacing.sp3),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The device card at design size, or scaled down to fit — and only ever as
/// TALL as the part of it that shows: the bottom [_DevicePreview.titleOverlap]
/// (plus the fade's canvas tail) overflows this box, under the title.
class _PreviewBox extends StatelessWidget {
  const _PreviewBox();

  /// The card minus the band the title sits over.
  static const double visibleHeight =
      _DevicePreview.cardHeight - _DevicePreview.titleOverlap;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final double scale = math.min(1, box.maxHeight / visibleHeight);
        return SizedBox(
          height: visibleHeight * scale,
          child: OverflowBox(
            alignment: Alignment.topCenter,
            minWidth: 0,
            maxWidth: double.infinity,
            minHeight: 0,
            maxHeight: double.infinity,
            child: SizedBox(
              width: _DevicePreview.width * scale,
              height: _DevicePreview.blockHeight * scale,
              child: const FittedBox(fit: BoxFit.fill, child: _DevicePreview()),
            ),
          ),
        );
      },
    );
  }
}

/// The Log screen behind a phone bezel, dissolving into the canvas.
///
/// The fade is drawn OVER the whole card — outline included — and reaches full
/// canvas a quarter of its length BEFORE the card ends, so the last
/// [hiddenBand] of the device (its bottom edge and the 5pt ink outline with
/// it) is simply gone rather than cropped. It keeps going past the card to
/// cover the elevation shadow too. Rendered at design size and scaled by the
/// [FittedBox] above it.
class _DevicePreview extends StatelessWidget {
  const _DevicePreview();

  static const double width = 226;
  static const double cardHeight = 452;
  static const double radius = 34;
  static const double outline = 5;

  /// The fade runs over the card's bottom [fadeHeight] and is fully canvas by
  /// [_fadeStop] of that — so the last 37.5pt of the device is invisible.
  static const double fadeHeight = 150;
  static const double fadeTop = cardHeight - fadeHeight;
  static const double _fadeStop = 0.75;

  /// Past the card, the fade stays canvas for the length of the drop shadow —
  /// otherwise the shadow survives the dissolve as a smudge under the title.
  static const double _shadowTail = 66;
  static const double blockHeight = cardHeight + _shadowTail;

  /// How far the title's top sits ABOVE the card's bottom edge — inside the
  /// 37.5pt the fade has already hidden, so the promise never lands on
  /// visible device.
  static const double titleOverlap = 28;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: blockHeight,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: cardHeight,
            child: Container(
              key: StartScreen.previewKey,
              decoration: BoxDecoration(
                color: KalloColors.elev,
                borderRadius: BorderRadius.circular(radius),
                border: Border.all(color: kInk, width: outline),
                boxShadow: const [
                  BoxShadow(
                    // 0 22 44 rgba(20,20,19,.20) — the one true elevation on
                    // this screen.
                    color: Color(0x33141413),
                    blurRadius: 44,
                    offset: Offset(0, 22),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(radius - outline),
                child: const Image(
                  image: AssetImage('assets/onboarding/log_preview.webp'),
                  fit: BoxFit.cover,
                  alignment: Alignment.topCenter,
                  excludeFromSemantics: true,
                ),
              ),
            ),
          ),
          const Positioned(
            top: fadeTop,
            left: 0,
            right: 0,
            bottom: 0,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      KalloColors.surface0,
                      KalloColors.surface,
                      KalloColors.surface,
                    ],
                    // The ramp is the design's 150pt fade; the rest of the
                    // rect is the shadow tail, already canvas.
                    stops: [
                      0,
                      fadeHeight * _fadeStop / (blockHeight - fadeTop),
                      1,
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
