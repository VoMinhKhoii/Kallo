import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../models/cheat.dart';
import '../../../shared/widgets/nham_text.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../logic/logging_spacing.dart';
import '../logic/slider_nutrition.dart';

/// Dot/track color per slider axis — mirrors the web `CHEAT_SLIDER_COLORS` so
/// the live card and the persisted recap stay in lockstep. Macro axes reuse the
/// shared macro palette; drinks borrows the warm accent.
Color cheatSliderColor(CheatSliderKey key) => switch (key) {
  CheatSliderKey.protein => NhamColors.macroProtein,
  CheatSliderKey.carbs => NhamColors.macroCarbs,
  CheatSliderKey.fat => NhamColors.macroFat,
  CheatSliderKey.drinks => NhamColors.accent,
};

/// One food-domain icon per axis — encodes the slider's identity (and shares
/// its accent color), matching the web `CHEAT_SLIDER_ICONS`.
IconData cheatSliderIcon(CheatSliderKey key) => switch (key) {
  CheatSliderKey.protein => LucideIcons.drumstick,
  CheatSliderKey.carbs => LucideIcons.wheat,
  CheatSliderKey.fat => LucideIcons.droplet,
  CheatSliderKey.drinks => LucideIcons.beer,
};

/// The interactive cheat-meal estimate: the occasion as a Lora quote, a live
/// `≈ kcal · P/C/F` readout, one 0–10 slider per axis with the six canonical
/// scenario stops, and a Save CTA. When the spec carries a clarifying question
/// (vague input), the card renders the question + option chips instead.
///
/// Ported from `components/logging/feed/cheat/cheat-slider-card.tsx`.
class CheatSliderCard extends StatefulWidget {
  const CheatSliderCard({
    super.key,
    required this.spec,
    required this.rawInput,
    required this.onConfirm,
    this.onClarify,
    this.busy = false,
  });

  final CheatSliderSpec spec;
  final String rawInput;

  /// Confirm with the chosen slider levels.
  final ValueChanged<CheatSliderLevels> onConfirm;

  /// Answer a clarifying question (rare vague-input fallback).
  final ValueChanged<String>? onClarify;
  final bool busy;

  @override
  State<CheatSliderCard> createState() => _CheatSliderCardState();
}

class _CheatSliderCardState extends State<CheatSliderCard> {
  late CheatSliderLevels _levels = defaultLevels(widget.spec);

  @override
  void didUpdateWidget(CheatSliderCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    // A different spec (e.g. a re-staged repeat) re-seeds the positions.
    if (!identical(oldWidget.spec, widget.spec)) {
      _levels = defaultLevels(widget.spec);
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = widget.spec.clarifyingQuestion;
    if (q != null) {
      return _ClarifyCard(
        rawInput: widget.rawInput,
        question: q,
        busy: widget.busy,
        onClarify: widget.onClarify,
      );
    }

    final resolved = resolveSliderNutrition(widget.spec, _levels);
    final macroLine = StringBuffer(
      'P ${resolved.proteinG.round()}g · C ${resolved.carbohydrateG.round()}g'
      ' · F ${resolved.fatG.round()}g',
    );
    if (resolved.alcoholG > 0) {
      macroLine.write(
        ' · ${'logging.cheatSliders.alcohol'.tr()} ${resolved.alcoholG.round()}g',
      );
    }

    // No bottom margin — the feed's footer stack owns the gap below.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: the occasion quote + the cheat badge.
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: NhamText(
                      widget.rawInput,
                      variant: NhamTextVariant.mealQuote,
                      style: const TextStyle(fontSize: 17, height: 1.625),
                    ),
                  ),
                  const SizedBox(width: NhamSpacing.sp3),
                  CheatBadge(label: 'logging.cheatSliders.badge'.tr()),
                ],
              ),
              const SizedBox(height: NhamSpacing.sp3),

              // Live calorie + macro readout — updates as sliders move.
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.end,
                spacing: NhamSpacing.sp3,
                runSpacing: 2,
                children: [
                  Text(
                    '≈ ${resolved.caloriesKcal} ${'logging.cheatSliders.kcal'.tr()}',
                    style: dashValue(),
                  ),
                  Text(
                    macroLine.toString(),
                    style: dashMeta(tabular: true),
                  ),
                ],
              ),
              const SizedBox(height: NhamSpacing.sp4),

              for (final (index, slider) in widget.spec.sliders.indexed) ...[
                if (index > 0) const SizedBox(height: NhamSpacing.sp4),
                _CheatSliderRow(
                  slider: slider,
                  level: _levels[slider.key] ?? slider.defaultLevel,
                  onChange:
                      (level) => setState(() => _levels[slider.key] = level),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: LoggingSpacing.block),
        _SaveButton(
          disabled: widget.busy,
          onTap: widget.busy ? null : () => widget.onConfirm(_levels),
        ),
      ],
    );
  }
}

/// One slider axis: icon + label, the 0–10 track (integer steps), and the six
/// canonical scenario stops alternating above / below the track — tappable to
/// jump. The exact stop reads emphasized; an odd (between) level highlights the
/// two bracketing stops.
class _CheatSliderRow extends StatelessWidget {
  const _CheatSliderRow({
    required this.slider,
    required this.level,
    required this.onChange,
  });

  final CheatSlider slider;
  final double level;
  final ValueChanged<double> onChange;

  @override
  Widget build(BuildContext context) {
    final color = cheatSliderColor(slider.key);
    final stops = [...slider.anchors]
      ..sort((a, b) => a.level.compareTo(b.level));
    final rounded = level.round();
    final onStop = rounded % 2 == 0;
    final betweenLow = onStop ? -1 : rounded - 1;
    final betweenHigh = onStop ? -1 : rounded + 1;

    String stopLabel(int at) {
      for (final s in stops) {
        if (s.level.round() == at) return s.label;
      }
      return '';
    }

    final valueText =
        onStop
            ? (stopLabel(rounded).isNotEmpty
                ? stopLabel(rounded)
                : slider.label)
            : 'logging.cheatSliders.between'.tr(
              namedArgs: {
                'low': stopLabel(betweenLow),
                'high': stopLabel(betweenHigh),
              },
            );

    Widget stopsBand({required bool top}) => SizedBox(
      height: 42,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth;
          const labelWidth = 84.0;
          return Stack(
            clipBehavior: Clip.none,
            children: [
              for (final (i, anchor) in stops.indexed)
                if ((i % 2 == 0) == top)
                  _StopLabel(
                    anchor: anchor,
                    trackWidth: width,
                    labelWidth: labelWidth,
                    top: top,
                    exact: onStop && anchor.level.round() == rounded,
                    between:
                        anchor.level.round() == betweenLow ||
                        anchor.level.round() == betweenHigh,
                    onTap: () {
                      HapticFeedback.selectionClick();
                      onChange(anchor.level);
                    },
                  ),
            ],
          );
        },
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(cheatSliderIcon(slider.key), size: 16, color: color),
            const SizedBox(width: 6),
            Text(
              slider.label,
              style: dashBody(weight: FontWeight.w500),
            ),
          ],
        ),
        stopsBand(top: true),
        Semantics(
          slider: true,
          label: slider.label,
          value: valueText,
          child: SliderTheme(
            data: SliderThemeData(
              trackHeight: 4,
              activeTrackColor: color,
              inactiveTrackColor: kTrack,
              thumbColor: color,
              overlayColor: color.withValues(alpha: 0.12),
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 9),
              overlayShape: const RoundSliderOverlayShape(overlayRadius: 18),
              tickMarkShape: SliderTickMarkShape.noTickMark,
            ),
            child: Slider(
              min: 0,
              max: 10,
              divisions: 10,
              value: level.clamp(0, 10).toDouble(),
              onChanged: (value) {
                if (value.round() != level.round()) {
                  HapticFeedback.selectionClick();
                }
                onChange(value.roundToDouble());
              },
            ),
          ),
        ),
        stopsBand(top: false),
      ],
    );
  }
}

/// A scenario label pinned at its point on the 0–10 scale. Edge stops align
/// outward; middle stops center on their position.
class _StopLabel extends StatelessWidget {
  const _StopLabel({
    required this.anchor,
    required this.trackWidth,
    required this.labelWidth,
    required this.top,
    required this.exact,
    required this.between,
    required this.onTap,
  });

  final CheatSliderAnchor anchor;
  final double trackWidth;
  final double labelWidth;
  final bool top;
  final bool exact;
  final bool between;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isLeftEdge = anchor.level <= 0;
    final isRightEdge = anchor.level >= 10;
    final center = trackWidth * (anchor.level / 10);
    final left =
        isLeftEdge
            ? 0.0
            : isRightEdge
            ? trackWidth - labelWidth
            : (center - labelWidth / 2).clamp(0.0, trackWidth - labelWidth);

    final style = dashMeta(color: exact || between ? kInk : kInkMuted).copyWith(
      height: 1.25,
      fontWeight: exact ? FontWeight.w500 : FontWeight.w400,
    );

    return Positioned(
      left: left,
      top: top ? null : 0,
      bottom: top ? 0 : null,
      width: labelWidth,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Text(
          anchor.label,
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
          textAlign:
              isLeftEdge
                  ? TextAlign.left
                  : isRightEdge
                  ? TextAlign.right
                  : TextAlign.center,
          style: style,
        ),
      ),
    );
  }
}

/// Vague-input fallback: the AI's single clarifying question + option chips.
class _ClarifyCard extends StatelessWidget {
  const _ClarifyCard({
    required this.rawInput,
    required this.question,
    required this.busy,
    required this.onClarify,
  });

  final String rawInput;
  final CheatClarifyingQuestion question;
  final bool busy;
  final ValueChanged<String>? onClarify;

  @override
  Widget build(BuildContext context) {
    final options = question.options ?? const <String>[];
    // No bottom margin — the feed's footer stack owns the gap below.
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (rawInput.isNotEmpty) ...[
            NhamText(
              rawInput,
              variant: NhamTextVariant.mealQuote,
              style: const TextStyle(fontSize: 17, height: 1.625),
            ),
            const SizedBox(height: NhamSpacing.sp3),
          ],
          Text(
            question.prompt,
            style: dashBody(),
          ),
          if (options.isNotEmpty) ...[
            const SizedBox(height: NhamSpacing.sp3),
            Wrap(
              spacing: NhamSpacing.sp2,
              runSpacing: NhamSpacing.sp2,
              children: [
                for (final option in options)
                  _ClarifyChip(
                    label: option,
                    disabled: busy || onClarify == null,
                    onTap: () => onClarify?.call(option),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _ClarifyChip extends StatefulWidget {
  const _ClarifyChip({
    required this.label,
    required this.disabled,
    required this.onTap,
  });

  final String label;
  final bool disabled;
  final VoidCallback onTap;

  @override
  State<_ClarifyChip> createState() => _ClarifyChipState();
}

class _ClarifyChipState extends State<_ClarifyChip> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: !widget.disabled,
      label: widget.label,
      child: Opacity(
        opacity: widget.disabled ? 0.5 : 1,
        child: GestureDetector(
          onTapDown:
              widget.disabled ? null : (_) => setState(() => _pressed = true),
          onTapUp:
              widget.disabled ? null : (_) => setState(() => _pressed = false),
          onTapCancel:
              widget.disabled ? null : () => setState(() => _pressed = false),
          onTap:
              widget.disabled
                  ? null
                  : () {
                    HapticFeedback.selectionClick();
                    widget.onTap();
                  },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(
              horizontal: NhamSpacing.sp3,
              vertical: 6,
            ),
            decoration: BoxDecoration(
              color: _pressed ? NhamColors.hover40 : Colors.transparent,
              borderRadius: BorderRadius.circular(NhamRadii.pill),
              border: Border.all(
                color: _pressed ? NhamColors.accent60 : NhamColors.borderSoft,
              ),
            ),
            child: Text(
              widget.label,
              style: dashBody(),
            ),
          ),
        ),
      ),
    );
  }
}

/// The accent-tinted "Cheat meal" badge with the PartyPopper icon (never red).
/// Shared by the live slider card and the persisted cheat card; each passes its
/// own localized [label].
class CheatBadge extends StatelessWidget {
  const CheatBadge({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: NhamColors.accent15,
        borderRadius: BorderRadius.circular(NhamRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(LucideIcons.partyPopper, size: 12, color: kInk),
          const SizedBox(width: 4),
          Text(
            label,
            style: dashMeta(color: kInk),
          ),
        ],
      ),
    );
  }
}

/// Full-width "Save meal" CTA below the card — the solid-umber primary action,
/// mirroring the precise entry's confirm button.
class _SaveButton extends StatefulWidget {
  const _SaveButton({required this.disabled, required this.onTap});

  final bool disabled;
  final VoidCallback? onTap;

  @override
  State<_SaveButton> createState() => _SaveButtonState();
}

class _SaveButtonState extends State<_SaveButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final tappable = widget.onTap != null;
    return Semantics(
      button: true,
      enabled: tappable,
      excludeSemantics: true,
      label: 'logging.cheatSliders.confirm'.tr(),
      onTap: widget.onTap,
      child: Opacity(
        opacity: widget.disabled ? 0.5 : 1,
        child: GestureDetector(
          onTapDown: tappable ? (_) => setState(() => _pressed = true) : null,
          onTapUp: tappable ? (_) => setState(() => _pressed = false) : null,
          onTapCancel: tappable ? () => setState(() => _pressed = false) : null,
          onTap: widget.onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
            decoration: BoxDecoration(
              color:
                  _pressed && tappable ? NhamColors.btnHover : NhamColors.btn,
              borderRadius: BorderRadius.circular(NhamRadii.xl),
              boxShadow: [
                _pressed && tappable ? NhamShadows.md : NhamShadows.sm,
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(LucideIcons.check, size: 14, color: Colors.white),
                const SizedBox(width: 6),
                Text(
                  'logging.cheatSliders.confirm'.tr(),
                  style: dashBody(color: Colors.white, weight: FontWeight.w500),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Card: rounded-2xl, border/60 hairline, shadow.sm, padding 16 — the same
/// shell the precise `MealEntry` uses.
class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp4),
      decoration: BoxDecoration(
        color: NhamColors.elev,
        borderRadius: BorderRadius.circular(NhamRadii.containerLg),
        border: Border.all(color: NhamColors.borderSoft),
        boxShadow: const [NhamShadows.sm],
      ),
      child: child,
    );
  }
}
