import 'package:flutter/material.dart';

import 'nham_colors.dart';
import 'nham_typography.dart';

/// Spacing scale: sp1=4 .. sp20=80, plus the recurring Tailwind fractional
/// steps (sp0_5=2, sp1_5=6, sp2_5=10, sp3_5=14) used across the design.
abstract final class NhamSpacing {
  static const double sp0_5 = 2; // mt-0.5
  static const double sp1 = 4;
  static const double sp1_5 = 6; // gap-1.5 / h-1.5
  static const double sp2 = 8;
  static const double sp2_5 = 10; // p-2.5 / py-2.5
  static const double sp3 = 12;
  static const double sp3_5 = 14; // gap-3.5
  static const double sp4 = 16;
  static const double sp5 = 20;
  static const double sp6 = 24;
  static const double sp8 = 32;
  static const double sp10 = 40;
  static const double sp12 = 48;
  static const double sp16 = 64;
  static const double sp20 = 80;
}

/// Border-radius scale.
/// One glyph size and one hit target for every icon-only control in the app.
///
/// App-wide on purpose: the design doc states 16/36 as a system rule, not a
/// per-surface decision, and the two per-surface copies of it were byte
/// identical with zero overrides between them.
abstract final class NhamIcons {
  /// Glyph size.
  static const double size = 16;

  /// Square tap target around the glyph. The pressed wash hugs the glyph, so
  /// the target can grow for accessibility without the affordance growing too.
  static const double hit = 36;
}

abstract final class NhamRadii {
  static const double sm = 6;
  static const double md = 8;
  static const double lg = 10;
  static const double buttonXl = 12;
  static const double containerLg = 16;
  static const double xl = 14;
  static const double container20 = 20; // rounded-[1.25rem] (today-dock blocks)
  static const double xxl = 18;
  static const double xxxl = 22;
  static const double xxxxl = 26;
  static const double pill = 9999;
}

/// Neutral ink-tinted, very low-contrast shadows (never #000-based).
abstract final class NhamShadows {
  static const BoxShadow xs = BoxShadow(
    color: Color(0x0A141413), // opacity ~4%
    blurRadius: 2,
    offset: Offset(0, 1),
  );

  static const BoxShadow sm = BoxShadow(
    color: Color(0x0D141413), // opacity ~5%
    blurRadius: 8,
    offset: Offset(0, 2),
  );

  static const BoxShadow md = BoxShadow(
    color: Color(0x0D141413), // opacity ~5%
    blurRadius: 16,
    offset: Offset(0, 10),
  );

  /// Warm accent-tinted input glow — resting.
  static const BoxShadow input = BoxShadow(
    color: Color(0x0FC9A87C), // opacity ~6%
    blurRadius: 20,
    offset: Offset(0, 4),
  );

  /// Warm accent-tinted input glow — focused.
  static const BoxShadow inputFocus = BoxShadow(
    color: Color(0x1FC9A87C), // opacity ~12%
    blurRadius: 20,
    offset: Offset(0, 4),
  );
}

/// Builds the Nham [ThemeData]. Surface = cream, card = white.
abstract final class NhamTheme {
  static ThemeData light() {
    final colorScheme = const ColorScheme.light(
      surface: NhamColors.surface,
      onSurface: NhamColors.text,
      primary: NhamColors.accent,
      onPrimary: NhamColors.elev,
      secondary: NhamColors.btn,
      onSecondary: NhamColors.elev,
      error: NhamColors.danger,
      onError: NhamColors.elev,
      outline: NhamColors.border,
      surfaceContainerLowest: NhamColors.elev,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: NhamColors.surface,
      cardColor: NhamColors.elev,
      dividerColor: NhamColors.border,
      textTheme: TextTheme(
        displayLarge: NhamTextStyles.displayLarge().copyWith(
          color: NhamColors.text,
        ),
        headlineLarge: NhamTextStyles.heading1().copyWith(
          color: NhamColors.text,
        ),
        headlineMedium: NhamTextStyles.heading2().copyWith(
          color: NhamColors.text,
        ),
        headlineSmall: NhamTextStyles.heading3().copyWith(
          color: NhamColors.text,
        ),
        titleLarge: NhamTextStyles.heading4().copyWith(color: NhamColors.text),
        bodyLarge: NhamTextStyles.bodyLarge().copyWith(color: NhamColors.text),
        bodyMedium: NhamTextStyles.body().copyWith(color: NhamColors.text),
        bodySmall: NhamTextStyles.bodySmall().copyWith(
          color: NhamColors.textMuted,
        ),
        labelLarge: NhamTextStyles.buttonLabel().copyWith(
          color: NhamColors.text,
        ),
        labelSmall: NhamTextStyles.caption().copyWith(
          color: NhamColors.textMuted,
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: NhamColors.surface,
        foregroundColor: NhamColors.text,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      cardTheme: CardThemeData(
        color: NhamColors.elev,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NhamRadii.xxl),
          side: const BorderSide(color: NhamColors.border, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: NhamColors.btn,
          foregroundColor: NhamColors.elev,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
          ),
          textStyle: NhamTextStyles.buttonLabel(),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: NhamColors.btn,
          side: const BorderSide(color: NhamColors.btnBorderGhost),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
          ),
          textStyle: NhamTextStyles.buttonLabel(),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: NhamColors.elev,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(NhamRadii.lg),
          borderSide: const BorderSide(color: NhamColors.borderBiscotti40),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(NhamRadii.lg),
          borderSide: const BorderSide(color: NhamColors.borderBiscotti40),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(NhamRadii.lg),
          borderSide: const BorderSide(color: NhamColors.accent, width: 1.5),
        ),
        hintStyle: NhamTextStyles.body().copyWith(
          color: NhamColors.placeholderMuted40,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: NhamSpacing.sp4,
          vertical: NhamSpacing.sp3,
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: NhamColors.border,
        thickness: 1,
        space: 0,
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: NhamColors.text,
          borderRadius: BorderRadius.circular(NhamRadii.md),
        ),
        textStyle: NhamTextStyles.sansRegular(
          fontSize: NhamFontSize.xs,
        ).copyWith(color: NhamColors.surface),
        padding: const EdgeInsets.symmetric(
          horizontal: NhamSpacing.sp3,
          vertical: NhamSpacing.sp1_5,
        ),
        preferBelow: true,
        triggerMode: TooltipTriggerMode.longPress,
        waitDuration: Duration.zero,
      ),
      // Branded toasts: espresso pill, cream text, soft radius — not the stock
      // dark-gray Material pill (sign-out errors, the undo toast, etc.).
      snackBarTheme: SnackBarThemeData(
        backgroundColor: NhamColors.text, // espresso
        contentTextStyle: NhamTextStyles.body().copyWith(
          fontSize: NhamFontSize.sm,
          color: NhamColors.surface, // cream
        ),
        actionTextColor: NhamColors.accent,
        behavior: SnackBarBehavior.floating,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NhamRadii.xl),
        ),
      ),
    );
  }
}
