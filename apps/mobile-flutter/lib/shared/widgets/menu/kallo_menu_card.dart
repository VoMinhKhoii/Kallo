import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../surface/kallo_pressable.dart';

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
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => KalloPressable(
    onTap: onTap,
    height: kKalloMenuRowHeight,
    padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: dashBody(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
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
      decoration: BoxDecoration(
        color: KalloColors.elev,
        borderRadius: radius,
        boxShadow: const [KalloShadows.md],
      ),
      child: ClipRRect(
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
