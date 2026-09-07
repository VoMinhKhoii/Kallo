import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/brand/kallo_wordmark.dart';
import '../../../shared/widgets/brand/wordmark_bar.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../shared/widgets/typography/meta_action.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../widgets/backdrop/dish_scatter.dart';
import '../widgets/backdrop/start_aurora.dart';

/// The signed-out entry (`/start`).
///
/// The first thing a new install sees: the wordmark on the aurora sweep, a
/// device preview of the Log screen ringed by ten clay dishes and dissolving
/// into the canvas, the promise in one line, and the two ways in — "Get
/// started" runs the wizard BEFORE sign-in (the answers live in a local draft
/// until `/save-plan`), and the quiet link is for the account that already
/// exists.
///
/// Two anchors, not one column: the wordmark row and the preview are measured
/// from the top of the SAFE AREA (8 and 68), while the title, the CTA and the
/// link hug the BOTTOM of it. The preview's fade then runs UNDER the title —
/// the promise reads as sitting in the dissolve, not as a caption butted
/// against a card's edge. Only the preview flexes: it is the one block that
/// can lose height without the screen losing meaning, so on a short phone it
/// scales down instead of pushing the CTA off the bottom.
class StartScreen extends StatelessWidget {
  const StartScreen({super.key});

  /// Design metrics, all measured from the top of the safe area.
  ///
  /// The lift (2026-09-06). The wordmark is this flow's top-centre header, so
  /// it now sits where every later screen's [WordmarkBar] sits — a 44pt row
  /// starting 8pt under the safe area, the mark centred in it — rather than
  /// floating 66pt down on its own. The block then starts 16pt under that row,
  /// at 68 instead of 132. Everything those two moves gave back goes into the
  /// block's fill scale: the art got bigger, the promise-to-CTA gap did not
  /// move.
  static const double _headerTop = 8;
  static const double _headerGap = 16;
  static const double _wordmarkHeight = 34;

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
              padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: _headerTop),
                  const SizedBox(
                    height: WordmarkBar.rowHeight,
                    child: Center(child: KalloWordmark(height: _wordmarkHeight)),
                  ),
                  const SizedBox(height: _headerGap),
                  // Everything the buttons do not claim: the preview and the
                  // promise sitting in its dissolve.
                  //
                  // The title starts ON the dissolve's bottom edge — its top
                  // sits [_DevicePreview.titleOffset] BELOW the card's bottom,
                  // where the band has been solid canvas for 29pt — so the
                  // promise reads as rising out of the fade rather than as a
                  // caption under a picture. Below it comes the design's 24pt
                  // of air, and every spare point on the screen goes into the
                  // block above, never into that gap.
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

/// The 390pt design block — dishes, device and dissolve — sized to EXACTLY the
/// height left between the wordmark and the bottom block. It ends on the
/// band's bottom edge, so nothing overflows downward: the title starts where
/// the block stops.
///
/// It fills rather than fits, in both directions. The design canvas is 390
/// wide and the block bleeds past both screen edges by design (the phở bowl
/// starts at x −2 at scale 1), so there is nothing to gain by capping the
/// scale at the phone's width — that cap is what left a hand's width of dead
/// canvas between the promise and the CTA on a modern phone. What bounds it
/// instead is the leftover height itself and [maxScale]; a short phone drives
/// the same ratio under 1 and the block shrinks exactly as it did before.
///
/// Because the box takes the whole leftover, the 24pt under the title is the
/// WHOLE gap to the CTA: every spare point goes into the art, not into air.
class _PreviewBox extends StatelessWidget {
  const _PreviewBox();

  /// All of it. The block ends on the band's bottom edge and the title starts
  /// there, so nothing overflows this box downward any more.
  static const double visibleHeight = _DevicePreview.blockHeight;

  /// The ceiling on a tall phone. Past this the device stops reading as a
  /// phone held at arm's length and starts reading as a cropped screenshot.
  static const double maxScale = 1.35;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final double scale = math.min(
          box.maxHeight / visibleHeight,
          maxScale,
        );
        return SizedBox(
          height: visibleHeight * scale,
          child: OverflowBox(
            alignment: Alignment.topCenter,
            minWidth: 0,
            maxWidth: double.infinity,
            minHeight: 0,
            maxHeight: double.infinity,
            child: SizedBox(
              width: DishScatter.canvasWidth * scale,
              height: _DevicePreview.blockHeight * scale,
              child: const FittedBox(fit: BoxFit.fill, child: _StartBlock()),
            ),
          ),
        );
      },
    );
  }
}

/// The scatter, the device and the dissolve stacked in canvas coordinates.
///
/// Order is the whole design: six dishes pass behind the phone, the phone,
/// then four that overlap its edge in front — and the dissolve LAST, over all
/// of them, so the dishes go with the device instead of surviving it as
/// clutter under the promise.
class _StartBlock extends StatelessWidget {
  const _StartBlock();

  /// Canvas x of the device card — 92, which centres 206 in 390.
  static const double _deviceLeft =
      (DishScatter.canvasWidth - _DevicePreview.width) / 2;

  @override
  Widget build(BuildContext context) => const SizedBox(
    width: DishScatter.canvasWidth,
    height: _DevicePreview.blockHeight,
    // Clipped along the bottom ONLY: the band's lower edge is where the art
    // stops, and the card's elevation shadow would otherwise carry 66pt past
    // it as a smudge behind the promise. The sides and the top stay open —
    // the scatter bleeds off both screen edges and the top two dishes reach
    // up into the air between the block and the wordmark.
    child: ClipRect(
      clipper: _BandBottom(),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(child: DishScatter(front: false)),
          Positioned(
            left: _deviceLeft,
            top: 0,
            width: _DevicePreview.width,
            height: _DevicePreview.cardHeight,
            child: _DevicePreview(),
          ),
          Positioned.fill(child: DishScatter(front: true)),
          Positioned(
            top: _DevicePreview.fadeTop,
            left: 0,
            right: 0,
            bottom: 0,
            child: _Dissolve(),
          ),
        ],
      ),
    ),
  );
}

/// Cuts everything below the box and nothing else.
class _BandBottom extends CustomClipper<Rect> {
  const _BandBottom();

  @override
  Rect getClip(Size size) => Rect.fromLTRB(
    -size.width,
    -size.height,
    size.width * 2,
    size.height,
  );

  @override
  bool shouldReclip(_BandBottom oldClipper) => false;
}

/// The Log screen behind a phone bezel. Rendered at design size and scaled by
/// the [FittedBox] above it.
class _DevicePreview extends StatelessWidget {
  const _DevicePreview();

  static const double width = 206;
  static const double cardHeight = 412;
  static const double radius = 34;
  static const double outline = 5;

  /// The canvas's dissolve, to the point: a 130pt band starting [fadeLead]
  /// ABOVE the card's bottom edge and ending [titleOffset] below it, going
  /// full canvas at [fadeStop] of its length — 27pt past the card's bottom.
  ///
  /// So the device's bottom edge is NOT hidden here; it fades out under the
  /// band, which is how the approved render reads. Earlier passes ran the ramp
  /// far enough up the card to erase the edge outright, and that swallowed the
  /// two lowest dishes with it. This is the band the scatter was drawn for.
  static const double fadeLead = 74;

  /// How far the band runs PAST the card's bottom edge — and so how far below
  /// it the title's top sits, because the block ends there and the title is
  /// the next thing in the column. By then the band has been solid canvas for
  /// 29pt.
  static const double titleOffset = 56;

  /// The band itself is [fadeLead] + [titleOffset] = 130pt tall; it needs no
  /// constant of its own because it runs from here to the block's bottom.
  static const double fadeTop = cardHeight - fadeLead;
  static const double fadeStop = 0.78;

  /// The block ends where the band does: nothing — no dish, no card edge, no
  /// elevation shadow — is drawn below it.
  static const double blockHeight = cardHeight + titleOffset;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: StartScreen.previewKey,
      decoration: BoxDecoration(
        color: KalloColors.elev,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: kInk, width: outline),
        boxShadow: const [
          BoxShadow(
            // 0 22 44 rgba(20,20,19,.20) — the one true elevation on this
            // screen.
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
    );
  }
}

/// The canvas swallowing the bottom of the block.
///
/// Drawn OVER everything — outline, dishes, elevation shadow — and reaching
/// full canvas a quarter of its length BEFORE the card ends, so the device's
/// bottom edge is simply gone rather than cropped. It runs the block's full
/// 390pt width, not the phone's, because the dishes have to dissolve with it.
class _Dissolve extends StatelessWidget {
  const _Dissolve();

  @override
  Widget build(BuildContext context) => const IgnorePointer(
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
          // This rect IS the band, so the recipe's 78% is the stop.
          stops: [0, _DevicePreview.fadeStop, 1],
        ),
      ),
    ),
  );
}
