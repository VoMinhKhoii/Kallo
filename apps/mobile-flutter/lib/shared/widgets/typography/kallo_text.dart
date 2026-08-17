import 'package:flutter/material.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_typography.dart';

/// The full RN text-variant set, ported 1:1 from
/// `apps/mobile/src/theme/text.tsx`.
///
/// Lora (serif) for display/headings/numbers > 18px and meal quotes — never
/// bold; DM Sans (sans) for everything else. The signature [italicAccent] is
/// Lora italic in tan. Numbers use tabular figures.
enum KalloTextVariant {
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
/// [KalloTextStyles], then merges any caller [style] on top (same precedence as
/// RN's `style={[styles[variant], style]}`).
class KalloText extends StatelessWidget {
  const KalloText(
    this.data, {
    super.key,
    this.variant = KalloTextVariant.body,
    this.style,
    this.textAlign,
    this.maxLines,
    this.overflow,
    this.softWrap,
  });

  final String data;
  final KalloTextVariant variant;
  final TextStyle? style;
  final TextAlign? textAlign;
  final int? maxLines;
  final TextOverflow? overflow;
  final bool? softWrap;

  static TextStyle styleFor(KalloTextVariant variant) {
    switch (variant) {
      case KalloTextVariant.display:
        // Lora regular (never bold — the bible's hardest type rule), display
        // size, display leading + tracking.
        return KalloTextStyles.serifRegular(
          fontSize: KalloFontSize.display,
          height: KalloLeading.display,
        ).copyWith(
          letterSpacing: KalloTracking.display,
          color: KalloColors.text,
        );
      case KalloTextVariant.h1:
        return KalloTextStyles.serifRegular(
          fontSize: KalloFontSize.h1,
          height: KalloLeading.tight,
        ).copyWith(letterSpacing: KalloTracking.tight, color: KalloColors.text);
      case KalloTextVariant.h2:
        return KalloTextStyles.serifRegular(
          fontSize: KalloFontSize.h2,
          height: KalloLeading.tight,
        ).copyWith(letterSpacing: KalloTracking.tight, color: KalloColors.text);
      case KalloTextVariant.h3:
        return KalloTextStyles.serifRegular(
          fontSize: KalloFontSize.h3,
          height: KalloLeading.tight,
        ).copyWith(color: KalloColors.text);
      case KalloTextVariant.h4:
        return KalloTextStyles.serifRegular(
          fontSize: KalloFontSize.h4,
          height: KalloLeading.snug,
        ).copyWith(color: KalloColors.text);
      case KalloTextVariant.lead:
        return KalloTextStyles.sansRegular(
          fontSize: KalloFontSize.lg,
          height: KalloLeading.relaxed,
        ).copyWith(color: KalloColors.textMuted);
      case KalloTextVariant.body:
        return KalloTextStyles.sansRegular(
          fontSize: KalloFontSize.md,
          height: KalloLeading.relaxed,
        ).copyWith(color: KalloColors.text);
      case KalloTextVariant.small:
        return KalloTextStyles.sansRegular(
          fontSize: KalloFontSize.sm,
          height: KalloLeading.normal,
        ).copyWith(color: KalloColors.textMuted);
      case KalloTextVariant.meta:
        return KalloTextStyles.sansRegular(
          fontSize: KalloFontSize.xxs,
          height: KalloLeading.normal,
        ).copyWith(color: KalloColors.stone);
      case KalloTextVariant.eyebrow:
        // sansBold 10px, wide eyebrow tracking, uppercase, stone.
        return KalloTextStyles.sansBold(fontSize: KalloFontSize.eyebrow).copyWith(
          letterSpacing: KalloTracking.eyebrow,
          color: KalloColors.stone,
        );
      case KalloTextVariant.mealQuote:
        return KalloTextStyles.serifRegular(
          fontSize: KalloFontSize.lg,
          height: KalloLeading.relaxed,
        ).copyWith(color: KalloColors.text);
      case KalloTextVariant.numDisplay:
        return KalloTextStyles.serifRegular(fontSize: KalloFontSize.h2).copyWith(
          letterSpacing: KalloTracking.display,
          color: KalloColors.text,
          fontFeatures: const [_tabularNums],
        );
      case KalloTextVariant.numInline:
        return KalloTextStyles.sansSemiBold(fontSize: KalloFontSize.md).copyWith(
          color: KalloColors.text,
          fontFeatures: const [_tabularNums],
        );
      case KalloTextVariant.italicAccent:
        return KalloTextStyles.serifItalic(
          fontSize: KalloFontSize.lg,
          height: KalloLeading.relaxed,
        ).copyWith(color: KalloColors.accent);
      case KalloTextVariant.chipText:
        return KalloTextStyles.sansMedium(fontSize: KalloFontSize.xs)
            .copyWith(color: KalloColors.textMuted);
      case KalloTextVariant.numCaption:
        return KalloTextStyles.sansSemiBold(fontSize: KalloFontSize.xs).copyWith(
          color: KalloColors.textMuted,
          fontFeatures: const [_tabularNums],
        );
      case KalloTextVariant.macroLabel:
        return KalloTextStyles.sansBold(fontSize: KalloFontSize.eyebrow).copyWith(
          letterSpacing: KalloTracking.wide,
          color: KalloColors.textMuted,
        );
      case KalloTextVariant.macroValue:
        return KalloTextStyles.sansRegular(fontSize: KalloFontSize.xxs).copyWith(
          color: KalloColors.textMuted,
          fontFeatures: const [_tabularNums],
        );
      // itemMacro / macroTiny / macroInline are identical aliases.
      case KalloTextVariant.itemMacro:
      case KalloTextVariant.macroTiny:
      case KalloTextVariant.macroInline:
        return KalloTextStyles.sansRegular(fontSize: KalloFontSize.eyebrow)
            .copyWith(
          color: KalloColors.textMuted,
          fontFeatures: const [_tabularNums],
        );
      case KalloTextVariant.itemName:
        return KalloTextStyles.sansMedium(fontSize: KalloFontSize.detail)
            .copyWith(color: KalloColors.text);
      // itemCalories / calorieBold are identical aliases.
      case KalloTextVariant.itemCalories:
      case KalloTextVariant.calorieBold:
        return KalloTextStyles.sansBold(fontSize: KalloFontSize.detail).copyWith(
          color: KalloColors.text,
          fontFeatures: const [_tabularNums],
        );
      case KalloTextVariant.pillLabel:
        return KalloTextStyles.sansMedium(fontSize: KalloFontSize.eyebrow);
      case KalloTextVariant.timeLabel:
        return KalloTextStyles.sansBold(fontSize: KalloFontSize.xxs).copyWith(
          letterSpacing: 1.1,
          color: KalloColors.textMuted60,
        );
      case KalloTextVariant.phaseLabel:
        return KalloTextStyles.sansRegular(
          fontSize: KalloFontSize.xxs,
          height: KalloLeading.normal,
        ).copyWith(color: KalloColors.textMuted);
      case KalloTextVariant.captionTabular:
        return KalloTextStyles.sansRegular(
          fontSize: KalloFontSize.xxs,
          height: KalloLeading.normal,
        ).copyWith(
          color: KalloColors.textMuted,
          fontFeatures: const [_tabularNums],
        );
      case KalloTextVariant.numStrong:
        return KalloTextStyles.sansBold(fontSize: KalloFontSize.md).copyWith(
          color: KalloColors.text,
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
    final isUppercase = variant == KalloTextVariant.eyebrow ||
        variant == KalloTextVariant.macroLabel;

    // macroValue is right-aligned in RN unless overridden.
    final resolvedAlign = textAlign ??
        (variant == KalloTextVariant.macroValue ? TextAlign.right : null);

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
