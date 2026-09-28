import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../surface/kallo_pressable.dart';
import '../../../theme/kallo_shapes.dart';

/// The popover's fixed width. Wide enough for a two-word label plus its glyph,
/// narrow enough that the card still reads as hanging off the control it was
/// opened from rather than as a panel of its own.
const double kKalloMenuWidth = 240;

/// One action row. 44 — the iOS minimum, and a step under the 56pt settings
/// [ListRow]: a menu is a short burst of choices, not a page of them.
const double kKalloMenuRowHeight = 44;

/// The optional time/context header. Fixed rather than intrinsic ON PURPOSE:
/// it is what makes [kalloMenuCardHeight] exact, and the card's height has to
/// be known BEFORE layout so the menu can decide to flip above its anchor in
/// the same frame it opens (see `kallo_anchored_menu.dart`).
const double kKalloMenuHeaderHeight = 40;

/// The 1px [kHairline] rule between rows, and under the header.
const double kKalloMenuHairline = 1;

/// The height [KalloMenuCard] will take for [rows] rows, with or without a
/// [header] — computable in advance because every band in the card is fixed.
double kalloMenuCardHeight({required int rows, required bool header}) =>
    rows * kKalloMenuRowHeight +
    (rows > 0 ? rows - 1 : 0) * kKalloMenuHairline +
    (header ? kKalloMenuHeaderHeight + kKalloMenuHairline : 0);

/// One row of a [KalloMenuCard]: the label at the left in body type, its
/// Lucide glyph at the right.
///
/// Trailing, not leading. A menu row is a SENTENCE the user reads ("Copy",
/// "Edit") with the glyph confirming it; a settings row is an object the glyph
/// identifies before the label names it. The press is [KalloPressable] — the
/// app's one press wash — so a menu row and a settings row feel the same under
/// the finger even though they are shaped differently.
class KalloMenuActionRow extends StatelessWidget {
  const KalloMenuActionRow({
    super.key,
    required this.label,
    required this.onTap,
    this.icon,
    this.badge,
    this.detail,
    this.checked,
  });

  final String label;

  /// The trailing glyph that confirms an action. A pull-down's rows carry
  /// none: the check column says what is chosen.
  final IconData? icon;
  final VoidCallback onTap;

  /// A marker at the row's right end, just left of the glyph (the Premium
  /// chip) — the same slot a check takes on a list row.
  final Widget? badge;

  /// A muted value at the row's end — what the choice amounts to ("100 ml").
  final String? detail;

  /// Null for an action menu. For a pull-down every row reserves a leading
  /// check column, ticked on the current choice — the iOS pull-down anatomy.
  final bool? checked;

  @override
  Widget build(BuildContext context) => KalloPressable(
    onTap: onTap,
    height: kKalloMenuRowHeight,
    padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
    child: Row(
      children: [
        if (checked != null)
          SizedBox(
            width: KalloIcons.tertiary + KalloSpacing.sp2,
            child:
                checked!
                    ? const Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: Icon(
                        LucideIcons.check300,
                        size: KalloIcons.tertiary,
                        color: KalloColors.text,
                      ),
                    )
                    : null,
          ),
        Expanded(
          child: Text(
            label,
            style: dashBody(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (detail != null) ...[
          const SizedBox(width: KalloSpacing.sp2),
          Text(detail!, style: dashMeta()),
        ],
        if (badge != null) ...[badge!, const SizedBox(width: KalloSpacing.sp2)],
        if (icon != null)
          Icon(icon, size: KalloIcons.tertiary, color: KalloColors.textSoft),
      ],
    ),
  );
}

/// The card itself: an optional muted [header] over hairline-separated [rows].
///
/// TRUE elevation ([KalloShadows.md]) — unlike an ordinary card, which on the
/// `#F8F7F4` canvas separates by surface alone. It is clipped to its own radius
/// because [KalloPressable]'s wash is full-bleed and would otherwise square the
/// first and last rows' corners while the finger is down.
class KalloMenuCard extends StatelessWidget {
  const KalloMenuCard({super.key, required this.rows, this.header});

  final List<KalloMenuActionRow> rows;
  final String? header;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(KalloRadii.xl);
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: KalloColors.elev,
        shape: KalloShapes.squircle(KalloRadii.xl),
        shadows: const [KalloShadows.md],
      ),
      child: ClipRSuperellipse(
        borderRadius: radius,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (header != null) ...[
              Container(
                height: kKalloMenuHeaderHeight,
                alignment: Alignment.centerLeft,
                padding: const EdgeInsets.symmetric(
                  horizontal: KalloSpacing.sp3,
                ),
                child: Text(header!, style: dashMeta()),
              ),
              const _Hairline(),
            ],
            for (var i = 0; i < rows.length; i++) ...[
              if (i > 0) const _Hairline(),
              rows[i],
            ],
          ],
        ),
      ),
    );
  }
}

class _Hairline extends StatelessWidget {
  const _Hairline();

  @override
  Widget build(BuildContext context) => const SizedBox(
    height: kKalloMenuHairline,
    child: ColoredBox(color: kHairline),
  );
}
