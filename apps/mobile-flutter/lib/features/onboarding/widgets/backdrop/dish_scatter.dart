import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// The ten clay dishes that hug the device preview on `/start`.
///
/// They alternate around the phone instead of sitting in a tidy row: six pass
/// BEHIND it and four overlap its edge from the FRONT, which is the only thing
/// that makes the preview read as an object on a table rather than a picture
/// pasted on a background. The front four clip the device's rim and no
/// further — the calorie ring, the composer and the message bubbles inside it
/// stay readable. Sushi and gỏi cuốn were pulled out to x 276 and x 18 (from
/// 251 and 40) for exactly that: at the canvas positions they each ate ~45pt
/// of the phone and took a line of a bubble with them; at ~20pt of overlap
/// they still touch the rim without covering anything that is meant to be
/// read.
///
/// Coordinates are the canvas's own: `left` is measured from the left of the
/// 390pt design canvas and `top` from the top of the PHONE, with [deviceTop]
/// subtracted at build time so this widget's own origin is the device card's
/// top-left corner. That is what lets the start screen scale the preview and
/// the scatter as one block on a short phone.
class DishScatter extends StatelessWidget {
  const DishScatter({super.key, required this.front});

  /// The design canvas these positions are measured on.
  static const double canvasWidth = 390;

  /// Canvas y of the device card's top — this widget's origin.
  static const double deviceTop = 132;

  /// `drop-shadow(0 10px 16px rgba(20,20,19,.12))`: CSS's blur radius is twice
  /// the Gaussian sigma.
  static const double _shadowDy = 10;
  static const double _shadowSigma = 8;
  static const Color _shadowInk = Color(0x1F141413);

  /// True for the four that overlap the device from the front.
  final bool front;

  static const List<_Dish> _behind = [
    _Dish('dish_ramen', 129, 22, 110, -10),
    _Dish('dish_banhmi', 136, 227, 103, 10),
    _Dish('dish_pho', 147, -2, 290, 6),
    _Dish('dish_tacos', 126, 254, 322, -6),
    _Dish('dish_pasta', 99, 16, 494, 4),
    _Dish('dish_curry', 92, 286, 506, -10),
  ];

  static const List<_Dish> _front = [
    _Dish('dish_dumplings', 101, 37, 209, 8),
    _Dish('dish_sushi', 106, 276, 219, -8),
    _Dish('dish_goicuon', 97, 18, 404, -8),
    _Dish('dish_bowl', 110, 243, 425, 12),
  ];

  @override
  Widget build(BuildContext context) => IgnorePointer(
    // The top two sit ABOVE the device card, in the air between it and the
    // wordmark, so the stack must not clip.
    child: Stack(
      clipBehavior: Clip.none,
      children: [
        for (final dish in front ? _front : _behind) _positioned(dish),
      ],
    ),
  );

  Widget _positioned(_Dish dish) => Positioned(
    left: dish.left,
    top: dish.top - deviceTop,
    width: dish.size,
    height: dish.size,
    child: Transform.rotate(
      angle: dish.degrees * math.pi / 180,
      child: _shadowed(dish),
    ),
  );

  /// Flutter has no drop-shadow filter for a transparent image, so the shadow
  /// is the image again: recoloured to a flat ink silhouette, blurred, and
  /// offset under the real one.
  Widget _shadowed(_Dish dish) {
    final Widget art = Image(
      image: AssetImage('assets/onboarding/${dish.asset}.webp'),
      fit: BoxFit.contain,
      excludeFromSemantics: true,
    );
    return Stack(
      fit: StackFit.expand,
      children: [
        Transform.translate(
          offset: const Offset(0, _shadowDy),
          child: ImageFiltered(
            imageFilter: ui.ImageFilter.blur(
              sigmaX: _shadowSigma,
              sigmaY: _shadowSigma,
            ),
            child: ColorFiltered(
              colorFilter: const ColorFilter.mode(_shadowInk, BlendMode.srcIn),
              child: art,
            ),
          ),
        ),
        art,
      ],
    );
  }
}

/// One dish: the asset, the square box it is CONTAINED in, its canvas position
/// and its tilt in degrees.
@immutable
class _Dish {
  const _Dish(this.asset, this.size, this.left, this.top, this.degrees);

  final String asset;
  final double size;
  final double left;
  final double top;
  final double degrees;
}
