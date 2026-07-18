import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../models/circle.dart';
import '../../../shared/widgets/nham_text.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../../../shared/widgets/profile_avatar.dart';

/// One friend's most-recent shared meal for today — a read-only clone of the
/// persisted-meal-card aesthetic (Lora dish quote, collapsible macros). No
/// likes, counts, badges, or leaderboards, by design. Mirrors the web
/// `CircleCard` in `components/groups/circle-wall.tsx`.
class CircleCard extends StatefulWidget {
  const CircleCard({required this.entry, super.key});

  final CircleFeedEntry entry;

  @override
  State<CircleCard> createState() => _CircleCardState();
}

class _CircleCardState extends State<CircleCard> {
  bool _collapsed = true;

  void _toggle() => setState(() => _collapsed = !_collapsed);

  @override
  Widget build(BuildContext context) {
    final entry = widget.entry;
    final meal = entry.meal;
    final na = tr('groups.wall.na');
    final label = entry.isSelf ? tr('groups.wall.you') : entry.friend.label;

    // P/C/F are hardcoded glyphs on the web too (not localized).
    final macros = 'P: ${_fmtG(meal.proteinG, na)}'
        '   C: ${_fmtG(meal.carbohydrateG, na)}'
        '   F: ${_fmtG(meal.fatG, na)}';
    final calories = _fmtKcal(meal.caloriesKcal, na);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Friend identity ────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.only(bottom: NhamSpacing.sp2),
          child: Row(
            children: [
              ProfileAvatarDisc(profile: entry.friend, size: 24),
              const SizedBox(width: NhamSpacing.sp2),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.xs)
                      .copyWith(color: NhamColors.text),
                ),
              ),
              const SizedBox(width: NhamSpacing.sp2),
              Text(
                tr('groups.wall.sharedAt',
                    namedArgs: {'time': _time(context, meal.sharedAt)}),
                style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.xxs)
                    .copyWith(color: NhamColors.textMuted60),
              ),
            ],
          ),
        ),

        // ── Card ───────────────────────────────────────────────────────
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(NhamSpacing.sp4),
          decoration: BoxDecoration(
            color: NhamColors.elev,
            borderRadius: BorderRadius.circular(NhamRadii.containerLg),
            border: Border.all(color: NhamColors.borderSoft),
            boxShadow: const [NhamShadows.xs],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      meal.rawInput,
                      style: NhamTextStyles.serifRegular(
                        fontSize: 17,
                        height: NhamLeading.relaxed,
                      ).copyWith(color: NhamColors.text),
                    ),
                  ),
                  const SizedBox(width: NhamSpacing.sp2),
                  _ChevronToggle(collapsed: _collapsed, onTap: _toggle),
                ],
              ),
              // Macro summary (collapsed) / total (expanded) — a size+fade
              // crossfade in place of the web AnimatePresence.
              AnimatedSize(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeInOut,
                alignment: Alignment.topCenter,
                child: _collapsed
                    ? _Summary(macros: macros, calories: calories)
                    : _Total(macros: macros, calories: calories),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Collapsed: a quiet single line — macros left, bold calories right.
class _Summary extends StatelessWidget {
  const _Summary({required this.macros, required this.calories});

  final String macros;
  final String calories;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: NhamSpacing.sp2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(
            child: NhamText(macros, variant: NhamTextVariant.captionTabular),
          ),
          NhamText(
            calories,
            variant: NhamTextVariant.numStrong,
            // Web collapsed kcal is text-sm (14) — numStrong defaults to 16.
            style: const TextStyle(fontSize: NhamFontSize.sm),
          ),
        ],
      ),
    );
  }
}

/// Expanded: a dashed rule then the labelled "Total" row.
class _Total extends StatelessWidget {
  const _Total({required this.macros, required this.calories});

  final String macros;
  final String calories;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: NhamSpacing.sp5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _DashedRule(),
          const SizedBox(height: NhamSpacing.sp3),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                tr('groups.wall.total'),
                style: NhamTextStyles.sansBold(fontSize: NhamFontSize.detail)
                    .copyWith(color: NhamColors.text),
              ),
              Flexible(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Flexible(
                      child: NhamText(macros,
                          variant: NhamTextVariant.captionTabular,
                          textAlign: TextAlign.right),
                    ),
                    const SizedBox(width: NhamSpacing.sp4),
                    Text(
                      calories,
                      style:
                          NhamTextStyles.sansBold(fontSize: NhamFontSize.md)
                              .copyWith(
                        color: NhamColors.text,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// A 1px dashed hairline (the web `border-t border-dashed`).
class _DashedRule extends StatelessWidget {
  const _DashedRule();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const dash = 3.0;
        const gap = 3.0;
        final count = (constraints.maxWidth / (dash + gap)).floor();
        return Row(
          children: List.generate(
            count,
            (_) => Container(
              width: dash,
              height: 1,
              margin: const EdgeInsets.only(right: gap),
              color: NhamColors.borderHalf,
            ),
          ),
        );
      },
    );
  }
}

/// The rotating chevron that expands / collapses the card details.
class _ChevronToggle extends StatelessWidget {
  const _ChevronToggle({required this.collapsed, required this.onTap});

  final bool collapsed;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tr('groups.wall.toggleDetails'),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(NhamSpacing.sp1),
          child: AnimatedRotation(
            turns: collapsed ? 0 : 0.5,
            duration: const Duration(milliseconds: 200),
            child: const Icon(
              LucideIcons.chevronDown,
              size: 16,
              color: NhamColors.textMuted60,
            ),
          ),
        ),
      ),
    );
  }
}

String _fmtG(double? v, String na) => v == null ? na : '${v.round()}g';

String _fmtKcal(double? v, String na) =>
    v == null ? na : '${v.round()} kcal';

String _time(BuildContext context, String iso) {
  final dt = DateTime.tryParse(iso);
  if (dt == null) return '';
  // Locale-aware short time (e.g. "9:15 AM" / "09:15") — matches the logging
  // card and the web's 2-digit toLocaleTimeString, instead of forcing 24h.
  return DateFormat.jm(context.locale.toString()).format(dt.toLocal());
}
