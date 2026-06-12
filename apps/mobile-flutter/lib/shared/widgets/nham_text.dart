import 'package:flutter/material.dart';

import '../../theme/nham_colors.dart';
import '../../theme/nham_typography.dart';

/// The full RN text-variant set, ported 1:1 from
/// `apps/mobile/src/theme/text.tsx`.
///
/// Lora (serif) for display/headings/numbers > 18px and meal quotes — never
/// bold; DM Sans (sans) for everything else. The signature [italicAccent] is
/// Lora italic in tan. Numbers use tabular figures.
enum NhamTextVariant {
  display,
  h1,
  h2,
  h3,
  h4,
  lead,
  body,
  small,
  meta,
  eyebrow,
  mealQuote,
  numDisplay,
  numInline,
  italicAccent,
  chipText,
  numCaption,
  macroLabel,
  macroValue,
  itemMacro,
  macroTiny,
  macroInline,
  itemName,
  itemCalories,
  calorieBold,
  pillLabel,
  timeLabel,
  phaseLabel,
  captionTabular,
  numStrong,
}

/// `tabular-nums` font feature — keeps digit columns aligned.
const FontFeature _tabularNums = FontFeature.tabularFigures();

/// RN `<Text variant=…>` port. Resolves the variant to a [TextStyle] built from
/// [NhamTextStyles], then merges any caller [style] on top (same precedence as
/// RN's `style={[styles[variant], style]}`).
class NhamText extends StatelessWidget {
  const NhamText(
    this.data, {
    super.key,
    this.variant = NhamTextVariant.body,
    this.style,
    this.textAlign,
    this.maxLines,
    this.overflow,
    this.softWrap,
  });

  final String data;
  final NhamTextVariant variant;
  final TextStyle? style;
  final TextAlign? textAlign;
  final int? maxLines;
  final TextOverflow? overflow;
  final bool? softWrap;

  static TextStyle styleFor(NhamTextVariant variant) {
    switch (variant) {
      case NhamTextVariant.display:
        // Lora regular (never bold — the bible's hardest type rule), display
        // size, display leading + tracking.
        return NhamTextStyles.serifRegular(
          fontSize: NhamFontSize.display,
          height: NhamLeading.display,
        ).copyWith(
          letterSpacing: NhamTracking.display,
          color: NhamColors.text,
        );
      case NhamTextVariant.h1:
        return NhamTextStyles.serifRegular(
          fontSize: NhamFontSize.h1,
          height: NhamLeading.tight,
        ).copyWith(letterSpacing: NhamTracking.tight, color: NhamColors.text);
      case NhamTextVariant.h2:
        return NhamTextStyles.serifRegular(
          fontSize: NhamFontSize.h2,
          height: NhamLeading.tight,
        ).copyWith(letterSpacing: NhamTracking.tight, color: NhamColors.text);
      case NhamTextVariant.h3:
        return NhamTextStyles.serifRegular(
          fontSize: NhamFontSize.h3,
          height: NhamLeading.tight,
        ).copyWith(color: NhamColors.text);
      case NhamTextVariant.h4:
        return NhamTextStyles.serifRegular(
          fontSize: NhamFontSize.h4,
          height: NhamLeading.snug,
        ).copyWith(color: NhamColors.text);
      case NhamTextVariant.lead:
        return NhamTextStyles.sansRegular(
          fontSize: NhamFontSize.lg,
          height: NhamLeading.relaxed,
        ).copyWith(color: NhamColors.textMuted);
      case NhamTextVariant.body:
        return NhamTextStyles.sansRegular(
          fontSize: NhamFontSize.md,
          height: NhamLeading.relaxed,
        ).copyWith(color: NhamColors.text);
      case NhamTextVariant.small:
        return NhamTextStyles.sansRegular(
          fontSize: NhamFontSize.sm,
          height: NhamLeading.normal,
        ).copyWith(color: NhamColors.textMuted);
      case NhamTextVariant.meta:
        return NhamTextStyles.sansRegular(
          fontSize: NhamFontSize.xxs,
          height: NhamLeading.normal,
        ).copyWith(color: NhamColors.stone);
      case NhamTextVariant.eyebrow:
        // sansBold 10px, wide eyebrow tracking, uppercase, stone.
        return NhamTextStyles.sansBold(fontSize: NhamFontSize.eyebrow).copyWith(
          letterSpacing: NhamTracking.eyebrow,
          color: NhamColors.stone,
        );
      case NhamTextVariant.mealQuote:
        return NhamTextStyles.serifRegular(
          fontSize: NhamFontSize.lg,
          height: NhamLeading.relaxed,
        ).copyWith(color: NhamColors.text);
      case NhamTextVariant.numDisplay:
        return NhamTextStyles.serifRegular(fontSize: NhamFontSize.h2).copyWith(
          letterSpacing: NhamTracking.display,
          color: NhamColors.text,
          fontFeatures: const [_tabularNums],
        );
      case NhamTextVariant.numInline:
        return NhamTextStyles.sansSemiBold(fontSize: NhamFontSize.md).copyWith(
          color: NhamColors.text,
          fontFeatures: const [_tabularNums],
        );
      case NhamTextVariant.italicAccent:
        return NhamTextStyles.serifItalic(
          fontSize: NhamFontSize.lg,
          height: NhamLeading.relaxed,
        ).copyWith(color: NhamColors.accent);
      case NhamTextVariant.chipText:
        return NhamTextStyles.sansMedium(fontSize: NhamFontSize.xs)
            .copyWith(color: NhamColors.textMuted);
      case NhamTextVariant.numCaption:
        return NhamTextStyles.sansSemiBold(fontSize: NhamFontSize.xs).copyWith(
          color: NhamColors.textMuted,
          fontFeatures: const [_tabularNums],
        );
      case NhamTextVariant.macroLabel:
        return NhamTextStyles.sansBold(fontSize: NhamFontSize.eyebrow).copyWith(
          letterSpacing: NhamTracking.wide,
          color: NhamColors.textMuted,
        );
      case NhamTextVariant.macroValue:
        return NhamTextStyles.sansRegular(fontSize: NhamFontSize.xxs).copyWith(
          color: NhamColors.textMuted,
          fontFeatures: const [_tabularNums],
        );
      // itemMacro / macroTiny / macroInline are identical aliases.
      case NhamTextVariant.itemMacro:
      case NhamTextVariant.macroTiny:
      case NhamTextVariant.macroInline:
        return NhamTextStyles.sansRegular(fontSize: NhamFontSize.eyebrow)
            .copyWith(
          color: NhamColors.textMuted,
          fontFeatures: const [_tabularNums],
        );
      case NhamTextVariant.itemName:
        return NhamTextStyles.sansMedium(fontSize: NhamFontSize.detail)
            .copyWith(color: NhamColors.text);
      // itemCalories / calorieBold are identical aliases.
      case NhamTextVariant.itemCalories:
      case NhamTextVariant.calorieBold:
        return NhamTextStyles.sansBold(fontSize: NhamFontSize.detail).copyWith(
          color: NhamColors.text,
          fontFeatures: const [_tabularNums],
        );
      case NhamTextVariant.pillLabel:
        return NhamTextStyles.sansMedium(fontSize: NhamFontSize.eyebrow);
      case NhamTextVariant.timeLabel:
        return NhamTextStyles.sansBold(fontSize: NhamFontSize.xxs).copyWith(
          letterSpacing: 1.1,
          color: NhamColors.textMuted60,
        );
      case NhamTextVariant.phaseLabel:
        return NhamTextStyles.sansRegular(
          fontSize: NhamFontSize.xxs,
          height: NhamLeading.normal,
        ).copyWith(color: NhamColors.textMuted);
      case NhamTextVariant.captionTabular:
        return NhamTextStyles.sansRegular(
          fontSize: NhamFontSize.xxs,
          height: NhamLeading.normal,
        ).copyWith(
          color: NhamColors.textMuted,
          fontFeatures: const [_tabularNums],
        );
      case NhamTextVariant.numStrong:
        return NhamTextStyles.sansBold(fontSize: NhamFontSize.md).copyWith(
          color: NhamColors.text,
          fontFeatures: const [_tabularNums],
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final base = styleFor(variant);
    final resolved = style == null ? base : base.merge(style);

    // RN `textTransform: 'uppercase'` lives on eyebrow + macroLabel; Flutter has
    // no text-transform, so uppercase the data to match.
    final isUppercase = variant == NhamTextVariant.eyebrow ||
        variant == NhamTextVariant.macroLabel;

    // macroValue is right-aligned in RN unless overridden.
    final resolvedAlign = textAlign ??
        (variant == NhamTextVariant.macroValue ? TextAlign.right : null);

    return Text(
      isUppercase ? data.toUpperCase() : data,
      style: resolved,
      textAlign: resolvedAlign,
      maxLines: maxLines,
      overflow: overflow,
      softWrap: softWrap,
    );
  }
}
