import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../backdrop/dish_scatter.dart';
import 'start_device_preview.dart';

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
class StartPreviewBox extends StatelessWidget {
  const StartPreviewBox({super.key, this.dissolve = true});

  /// Whether the block fades out at its foot. `/start`'s single column sets
  /// its title in that fade. Beside the fold nothing follows the block, so
  /// the far pane shows the device and its dishes whole.
  final bool dissolve;

  /// All of it. The block ends on the band's bottom edge and the title starts
  /// there, so nothing overflows this box downward any more.
  static const double visibleHeight = StartDevicePreview.blockHeight;

  /// The ceiling on a tall phone. Past this the device stops reading as a
  /// phone held at arm's length and starts reading as a cropped screenshot.
  static const double maxScale = 1.35;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final double scale = math.min(box.maxHeight / visibleHeight, maxScale);
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
              height: StartDevicePreview.blockHeight * scale,
              child: FittedBox(
                fit: BoxFit.fill,
                child: _StartBlock(dissolve: dissolve),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// The scatter and the device stacked in canvas coordinates, dissolving at
/// the bottom.
///
/// Order is the whole design: six dishes pass behind the phone, the phone,
/// then four that overlap its edge in front. The dissolve takes all of them
/// together, so the dishes go with the device instead of surviving it as
/// clutter under the promise.
///
/// The dissolve is a mask, not canvas painted over the art: the block fades
/// to whatever is behind it. Beside the fold it stands on the wizard's
/// backdrop as well as on `/start`'s, and a band of flat canvas there cut a
/// straight edge into the colour under it.
class _StartBlock extends StatelessWidget {
  const _StartBlock({required this.dissolve});

  final bool dissolve;

  /// Canvas x of the device card — 92, which centres 206 in 390.
  static const double _deviceLeft =
      (DishScatter.canvasWidth - StartDevicePreview.width) / 2;

  /// Solid down to the band's top, gone [StartDevicePreview.fadeStop] of the
  /// way through it. The card's bottom edge falls inside the ramp, so it
  /// fades out rather than being cropped.
  static Shader _dissolve(Rect bounds) => const LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Color(0xFFFFFFFF),
      Color(0xFFFFFFFF),
      Color(0x00FFFFFF),
      Color(0x00FFFFFF),
    ],
    stops: [
      0,
      StartDevicePreview.fadeTop / StartDevicePreview.blockHeight,
      (StartDevicePreview.fadeTop +
              (StartDevicePreview.blockHeight - StartDevicePreview.fadeTop) *
                  StartDevicePreview.fadeStop) /
          StartDevicePreview.blockHeight,
      1,
    ],
  ).createShader(bounds);

  static const Widget _art = Stack(
    clipBehavior: Clip.none,
    children: [
      Positioned.fill(child: DishScatter(front: false)),
      Positioned(
        left: _deviceLeft,
        top: 0,
        width: StartDevicePreview.width,
        height: StartDevicePreview.cardHeight,
        child: StartDevicePreview(),
      ),
      Positioned.fill(child: DishScatter(front: true)),
    ],
  );

  @override
  Widget build(BuildContext context) => SizedBox(
    width: DishScatter.canvasWidth,
    height: StartDevicePreview.blockHeight,
    // Clipped along the bottom ONLY: the band's lower edge is where the art
    // stops, and the card's elevation shadow would otherwise carry 66pt past
    // it as a smudge behind the promise. The sides and the top stay open —
    // the scatter bleeds off both screen edges and the top two dishes reach
    // up into the air between the block and the wordmark.
    child:
        dissolve
            ? const ClipRect(
              clipper: _BandBottom(),
              child: ShaderMask(
                blendMode: BlendMode.dstIn,
                shaderCallback: _dissolve,
                child: _art,
              ),
            )
            : _art,
  );
}

/// Cuts everything below the box and nothing else.
class _BandBottom extends CustomClipper<Rect> {
  const _BandBottom();

  @override
  Rect getClip(Size size) =>
      Rect.fromLTRB(-size.width, -size.height, size.width * 2, size.height);

  @override
  bool shouldReclip(_BandBottom oldClipper) => false;
}
