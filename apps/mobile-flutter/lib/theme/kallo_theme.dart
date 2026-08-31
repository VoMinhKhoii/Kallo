import 'package:flutter/material.dart';

import 'kallo_colors.dart';
import 'kallo_typography.dart';

/// Spacing scale: sp1=4 .. sp20=80, plus the recurring Tailwind fractional
/// steps (sp0_5=2, sp1_5=6, sp2_5=10, sp3_5=14) used across the design.
abstract final class KalloSpacing {
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

/// One glyph size and one hit target for every icon-only control in the app.
///
/// App-wide on purpose: the design doc states this as a system rule, not a
/// per-surface decision, and the two per-surface copies of it were byte
/// identical with zero overrides between them.
abstract final class KalloIcons {
  /// Glyph size. 24 — Material's own default, and the size a row glyph has to
  /// be to carry its row rather than trail it (the Threads settings reference).
  /// 16 read as a decoration beside 14pt labels.
  static const double size = 24;

  /// Square tap target around the glyph. The pressed wash hugs the glyph, so
  /// the target can grow for accessibility without the affordance growing too.
  /// 44 — the iOS minimum; grown from 36 in the native pass (2026-08-31).
  static const double hit = 44;
}

/// Border-radius scale.
abstract final class KalloRadii {
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

  // Semantic aliases (native pass, 2026-08-31) — prefer these in new code.
  static const double card = xxxl; // 22 — every card, no border/shadow
  static const double sheet = xxxl; // 22 22 0 0 top corners
  static const double input = xxxxl; // 26 — full-round 52pt text fields
  static const double button = pill; // full-round on any full-width button
}

/// Neutral ink-tinted, very low-contrast shadows (never #000-based).
abstract final class KalloShadows {
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
abstract final class KalloTheme {
  static ThemeData light() {
    final colorScheme = const ColorScheme.light(
      surface: KalloColors.surface,
      onSurface: KalloColors.text,
      primary: KalloColors.accent,
      onPrimary: KalloColors.elev,
      secondary: KalloColors.btn,
      onSecondary: KalloColors.elev,
      error: KalloColors.danger,
      onError: KalloColors.elev,
      outline: KalloColors.border,
      surfaceContainerLowest: KalloColors.elev,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: KalloColors.surface,
      cardColor: KalloColors.elev,
      dividerColor: KalloColors.border,
      textTheme: TextTheme(
        displayLarge: KalloTextStyles.displayLarge().copyWith(
          color: KalloColors.text,
        ),
        headlineLarge: KalloTextStyles.heading1().copyWith(
          color: KalloColors.text,
        ),
        headlineMedium: KalloTextStyles.heading2().copyWith(
          color: KalloColors.text,
        ),
        headlineSmall: KalloTextStyles.heading3().copyWith(
          color: KalloColors.text,
        ),
        titleLarge: KalloTextStyles.heading4().copyWith(color: KalloColors.text),
        bodyLarge: KalloTextStyles.bodyLarge().copyWith(color: KalloColors.text),
        bodyMedium: KalloTextStyles.body().copyWith(color: KalloColors.text),
        bodySmall: KalloTextStyles.bodySmall().copyWith(
          color: KalloColors.textMuted,
        ),
        labelLarge: KalloTextStyles.buttonLabel().copyWith(
          color: KalloColors.text,
        ),
        labelSmall: KalloTextStyles.caption().copyWith(
          color: KalloColors.textMuted,
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: KalloColors.surface,
        foregroundColor: KalloColors.text,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      // Cards separate by surface alone on the #F4F3EF canvas: solid white,
      // radius 22, NO border, NO shadow (native pass, 2026-08-31).
      cardTheme: CardThemeData(
        color: KalloColors.elev,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(KalloRadii.card),
        ),
      ),
      // The one context menu in the app (long-press a sent message). Same
      // white surface and hairline as a card; M3 would otherwise tint it by
      // elevation and round it to its own 4px radius.
      popupMenuTheme: PopupMenuThemeData(
        color: KalloColors.elev,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(KalloRadii.containerLg),
          side: const BorderSide(color: KalloColors.border, width: 1),
        ),
      ),
      // Dialogs are sheets that happen to be centred, so they wear the sheet's
      // surface and the one card radius. Without this M3 supplies a 28pt
      // radius, an elevation tint over the warm palette and a 40/24 inset —
      // the stock chrome that made the delete confirm look foreign.
      dialogTheme: DialogThemeData(
        backgroundColor: KalloColors.elev,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(KalloRadii.xxxl),
        ),
        insetPadding: const EdgeInsets.symmetric(
          horizontal: KalloSpacing.sp6,
          vertical: KalloSpacing.sp6,
        ),
        // The same black/50 scrim the nav drawer and the web dialog use.
        barrierColor: const Color(0x80000000),
      ),
      // In-app primary: beige + ink, fully rounded (auth/paywall CTAs use
      // [KalloColors.btnPrimary] black-and-white explicitly at call sites).
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: KalloColors.btnPrimarySoft,
          foregroundColor: KalloColors.text,
          shape: const StadiumBorder(),
          textStyle: KalloTextStyles.buttonLabel(),
        ),
      ),
      // Quiet: white + hairline, fully rounded.
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          backgroundColor: KalloColors.elev,
          foregroundColor: KalloColors.text,
          side: const BorderSide(color: KalloColors.border),
          shape: const StadiumBorder(),
          textStyle: KalloTextStyles.buttonLabel(),
        ),
      ),
      // Full-width fields are full-round pills: 52pt, radius 26, 18 left
      // inset, 2px tan focus border (native pass, 2026-08-31).
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: KalloColors.elev,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(KalloRadii.input),
          borderSide: const BorderSide(color: KalloColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(KalloRadii.input),
          borderSide: const BorderSide(color: KalloColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(KalloRadii.input),
          borderSide: const BorderSide(color: KalloColors.accent40, width: 2),
        ),
        hintStyle: KalloTextStyles.body().copyWith(
          color: KalloColors.placeholderMuted40,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: KalloSpacing.sp3_5,
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: KalloColors.border,
        thickness: 1,
        space: 0,
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: KalloColors.text,
          borderRadius: BorderRadius.circular(KalloRadii.md),
        ),
        textStyle: KalloTextStyles.sansRegular(
          fontSize: KalloFontSize.xs,
        ).copyWith(color: KalloColors.surface),
        padding: const EdgeInsets.symmetric(
          horizontal: KalloSpacing.sp3,
          vertical: KalloSpacing.sp1_5,
        ),
        preferBelow: true,
        triggerMode: TooltipTriggerMode.longPress,
        waitDuration: Duration.zero,
      ),
      // Branded toasts: espresso pill, cream text, soft radius — not the stock
      // dark-gray Material pill (sign-out errors, the undo toast, etc.).
      snackBarTheme: SnackBarThemeData(
        backgroundColor: KalloColors.text, // espresso
        contentTextStyle: KalloTextStyles.body().copyWith(
          fontSize: KalloFontSize.sm,
          color: KalloColors.surface, // cream
        ),
        actionTextColor: KalloColors.accent,
        behavior: SnackBarBehavior.floating,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(KalloRadii.xl),
        ),
      ),
    );
  }
}
