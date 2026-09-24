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
/// [kCardShadows] (the row lifts); idle is the 1px hairline. A tinted fill
/// collides with the press wash: colour marks the press, geometry the choice.
///
/// **Text wraps, the row grows.** [height] is a floor, not a size: a Vietnamese
/// hint ("Lớn hơn lòng bàn tay, ví dụ một đùi gà hoặc hơn") runs to a second
/// line, and a fixed 64 with one-line ellipsis clipped exactly the words that
/// explain the choice. Two-line content sits 12pt from the row's edges and
/// 4pt apart — one step more air than the 2pt it had.
///
/// Callers stack rows themselves with [KalloSpacing.sp3] gaps.
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
    this.trailing,
  });

  /// Body-size ink label — never bold. Weight is not how this row emphasises.
  final String label;

  /// Meta line under the label ("From your phone", an activity description).
  final String? subline;

  /// Quiet meta on the trailing edge — a ratio, a count, a price.
  final String? note;

  final bool selected;
  final VoidCallback onTap;

  /// The row's MINIMUM height — 64 default; 56 and 48 are the sanctioned
  /// tighter variants. Wrapped text grows it.
  final double height;

  final bool enabled;

  /// Decoration on the trailing edge, after [note] — the cooking step's
  /// portion drawings. Not announced: [label] and [subline] already say what
  /// the picture shows.
  final Widget? trailing;

  /// Vertical room between the row's edge and two-line content.
  static const double verticalInset = KalloSpacing.sp3;

  /// Label ↔ subline.
  static const double lineGap = KalloSpacing.sp1;

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
      surface:
          (context, pressed, body) => AnimatedContainer(
            duration: KalloMotion.press,
            curve: KalloEase.press,
            constraints: BoxConstraints(minHeight: height),
            decoration: BoxDecoration(
              // The press is the ink wash over white, the same one ListRow uses on
              // the canvas side — a warm wash on a white row barely registers.
              color:
                  pressed
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
        Expanded(
          child: Padding(
            // The border is paid for out of the inset, as the shell does
            // horizontally, so the text holds still when the row is picked.
            padding: EdgeInsets.symmetric(vertical: verticalInset - border),
            child: _text(),
          ),
        ),
        if (note != null) ...[
          const SizedBox(width: KalloSpacing.sp2),
          Text(note!, maxLines: 1, style: dashMeta()),
        ],
        if (trailing != null) ...[
          const SizedBox(width: KalloSpacing.sp2),
          ExcludeSemantics(child: trailing!),
        ],
      ],
    );
  }

  Widget _text() => Column(
    // Sized to its lines: the row's floor comes from [height], and a
    // max-size column would stretch the row to whatever height it is offered.
    mainAxisSize: MainAxisSize.min,
    mainAxisAlignment: MainAxisAlignment.center,
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: dashBody()),
      if (subline != null) ...[
        const SizedBox(height: lineGap),
        Text(subline!, style: dashMeta()),
      ],
    ],
  );
}
