import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_motion.dart';
import '../../../theme/kallo_theme.dart';
import 'option/option_row_shell.dart';

/// The one-of-many pick: a white 64pt row with a leading radio, used wherever
/// the onboarding wizard offers a small closed set (language, goal, activity,
/// carb split) — the choices are the content, so they sit on the page rather
/// than inside a grouped card.
///
/// **Selection is a border, not a fill.** Selected is a 2px [kInk] border plus
/// [kCardShadows] (the row lifts); idle is the 1px hairline every other surface
/// uses. A tinted fill was the obvious alternative and it collided with the
/// press wash — you could not tell "I am choosing this" from "I am touching
/// this". Colour marks the press, geometry marks the choice.
///
/// Callers stack rows themselves with [KalloSpacing.sp3] gaps; there is no
/// group widget, because every group so far wants a different header.
class OptionRow extends StatelessWidget {
  const OptionRow({
    super.key,
    required this.label,
    this.subline,
    this.note,
    required this.selected,
    required this.onTap,
    this.height = 64,
    this.enabled = true,
  });

  /// Body-size ink label — never bold. Weight is not how this row emphasises.
  final String label;

  /// Meta line under the label ("From your phone", an activity description).
  final String? subline;

  /// Quiet meta on the trailing edge — a ratio, a count, a price.
  final String? note;

  final bool selected;
  final VoidCallback onTap;

  /// 64 default; 56 and 48 are the sanctioned tighter variants.
  final double height;

  final bool enabled;

  static const double selectedBorder = 2, idleBorder = 1;
  static const double selectedRing = OptionRowShell.selectedRing;
  static const double idleRing = OptionRowShell.idleRing;

  @override
  Widget build(BuildContext context) {
    final double border = selected ? selectedBorder : idleBorder;
    return OptionRowShell(
      selected: selected,
      enabled: enabled,
      onTap: onTap,
      border: border,
      semanticsLabel: [label, subline, note].whereType<String>().join(', '),
      surface: (context, pressed, body) => AnimatedContainer(
        duration: KalloMotion.press,
        curve: KalloEase.press,
        height: height,
        decoration: BoxDecoration(
          // The press is the ink wash over white, the same one ListRow uses on
          // the canvas side — a warm wash on a white row barely registers.
          color: pressed
              ? Color.alphaBlend(KalloColors.pressWash, kCardSurface)
              : kCardSurface,
          borderRadius: BorderRadius.circular(KalloRadii.containerLg),
          border: Border.all(
            color: selected ? kInk : KalloColors.border,
            width: border,
          ),
          boxShadow: selected ? kCardShadows : null,
        ),
        child: body,
      ),
      children: [
        Expanded(child: _text()),
        if (note != null) ...[
          const SizedBox(width: KalloSpacing.sp2),
          Text(note!, maxLines: 1, style: dashMeta()),
        ],
      ],
    );
  }

  Widget _text() => Column(
    mainAxisAlignment: MainAxisAlignment.center,
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: dashBody()),
      if (subline != null) ...[
        const SizedBox(height: 2),
        Text(
          subline!,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: dashMeta(),
        ),
      ],
    ],
  );
}
