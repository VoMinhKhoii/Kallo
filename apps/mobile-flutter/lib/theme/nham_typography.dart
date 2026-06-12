import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Font size constants matching the web/RN design system.
abstract final class NhamFontSize {
  static const double display = 48;
  static const double h1 = 40;
  static const double h2 = 32;
  static const double h3 = 24;
  static const double h4 = 20;
  static const double lg = 18;
  static const double md = 16;
  static const double sm = 14;
  static const double detail = 13;
  static const double xs = 12;
  static const double xxs = 11;
  static const double eyebrow = 10;
}

/// Line-height multipliers.
abstract final class NhamLeading {
  static const double display = 1.1;
  static const double tight = 1.2;
  static const double snug = 1.35;
  static const double normal = 1.5;
  static const double relaxed = 1.65;
}

/// Letter-spacing values (in logical pixels).
abstract final class NhamTracking {
  static const double eyebrow = 2.0;
  static const double wide = 0.6;
  static const double tight = -0.3;
  static const double display = -1.4;
}

/// Text styles built from Lora (serif) and DM Sans (sans-serif).
///
/// Lora = display/serif (headings, numbers > 18px, meal quotes -- never bold).
/// DM Sans = UI/body (buttons, labels, tabular numbers).
abstract final class NhamTextStyles {
  // ── Serif (Lora) ───────────────────────────────────────────────────

  static TextStyle serifRegular({double? fontSize, double? height}) =>
      GoogleFonts.lora(
        fontWeight: FontWeight.w400,
        fontSize: fontSize,
        height: height,
      );

  static TextStyle serifMedium({double? fontSize, double? height}) =>
      GoogleFonts.lora(
        fontWeight: FontWeight.w500,
        fontSize: fontSize,
        height: height,
      );

  // No serifSemiBold: Lora is never above 400 (the bible's hardest type rule).
  // Deleted so a bold-Lora regression can't be reintroduced by reaching for it.

  static TextStyle serifItalic({double? fontSize, double? height}) =>
      GoogleFonts.lora(
        fontWeight: FontWeight.w400,
        fontStyle: FontStyle.italic,
        fontSize: fontSize,
        height: height,
      );

  // ── Sans (DM Sans) ────────────────────────────────────────────────

  static TextStyle sansRegular({double? fontSize, double? height}) =>
      GoogleFonts.dmSans(
        fontWeight: FontWeight.w400,
        fontSize: fontSize,
        height: height,
      );

  static TextStyle sansMedium({double? fontSize, double? height}) =>
      GoogleFonts.dmSans(
        fontWeight: FontWeight.w500,
        fontSize: fontSize,
        height: height,
      );

  static TextStyle sansSemiBold({double? fontSize, double? height}) =>
      GoogleFonts.dmSans(
        fontWeight: FontWeight.w600,
        fontSize: fontSize,
        height: height,
      );

  static TextStyle sansBold({double? fontSize, double? height}) =>
      GoogleFonts.dmSans(
        fontWeight: FontWeight.w700,
        fontSize: fontSize,
        height: height,
      );

  // ── Semantic presets ──────────────────────────────────────────────

  static TextStyle displayLarge() => serifRegular(
        fontSize: NhamFontSize.display,
        height: NhamLeading.display,
      ).copyWith(letterSpacing: NhamTracking.display);

  static TextStyle heading1() => serifRegular(
        fontSize: NhamFontSize.h1,
        height: NhamLeading.tight,
      );

  static TextStyle heading2() => serifRegular(
        fontSize: NhamFontSize.h2,
        height: NhamLeading.tight,
      );

  static TextStyle heading3() => serifMedium(
        fontSize: NhamFontSize.h3,
        height: NhamLeading.snug,
      );

  static TextStyle heading4() => serifMedium(
        fontSize: NhamFontSize.h4,
        height: NhamLeading.snug,
      );

  static TextStyle bodyLarge() => sansRegular(
        fontSize: NhamFontSize.lg,
        height: NhamLeading.normal,
      );

  static TextStyle body() => sansRegular(
        fontSize: NhamFontSize.md,
        height: NhamLeading.normal,
      );

  static TextStyle bodySmall() => sansRegular(
        fontSize: NhamFontSize.sm,
        height: NhamLeading.normal,
      );

  static TextStyle caption() => sansRegular(
        fontSize: NhamFontSize.xs,
        height: NhamLeading.normal,
      );

  static TextStyle eyebrow() => sansSemiBold(
        fontSize: NhamFontSize.eyebrow,
        height: NhamLeading.normal,
      ).copyWith(letterSpacing: NhamTracking.eyebrow);

  static TextStyle buttonLabel() => sansSemiBold(
        fontSize: NhamFontSize.sm,
        height: NhamLeading.snug,
      );
}
