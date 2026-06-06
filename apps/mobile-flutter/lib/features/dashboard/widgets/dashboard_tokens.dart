/// Dashboard-local design tokens not yet present in the shared theme.
///
/// These mirror exact web Tailwind values used by the dashboard cards
/// (`components/dashboard/**`). They live here (inside the dashboard feature)
/// rather than the shared theme so the dashboard fidelity pass stays
/// self-contained; promote to `lib/theme` if reused elsewhere.
library;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Web `rounded-[1.5rem]` = 24px (the dashboard card radius).
const double kCardRadius24 = 24;

/// Web `rounded-[1.25rem]` = 20px (cream blocks / weight-log card).
const double kBlockRadius20 = 20;

/// `border-nham-border/70` — biscotti hairline at 70% opacity (#e8d5b5).
const Color kBorder70 = Color(0xB3E8D5B5);

/// `bg-card/90` — white card at 90% opacity.
const Color kCard90 = Color(0xE6FFFFFF);

/// `bg-card/40` — white card at 40% opacity (dashed empty state).
const Color kCard40 = Color(0x66FFFFFF);

/// `bg-nham-surface/60` — paper cream at 60% opacity (#FEFBF6).
const Color kSurface60 = Color(0x99FEFBF6);

/// `bg-nham-surface/70` — paper cream at 70% opacity (#FEFBF6).
const Color kSurface70 = Color(0xB3FEFBF6);

/// `shadow-[0_10px_32px_rgba(44,36,22,0.05)]` — the soft espresso card shadow
/// shared by the dock / weight / heatmap / section-state cards.
const BoxShadow kCardShadow = BoxShadow(
  color: Color(0x0D2C2416), // #2C2416 @ 5%
  blurRadius: 32,
  offset: Offset(0, 10),
);

/// Web `font-mono` (Geist Mono). JetBrains Mono is the closest geometric
/// monospace available in google_fonts; used for tabular numeric values.
TextStyle dashMono({double? fontSize, FontWeight? fontWeight}) =>
    GoogleFonts.jetBrainsMono(
      fontSize: fontSize,
      fontWeight: fontWeight ?? FontWeight.w400,
      fontFeatures: const [FontFeature.tabularFigures()],
    );
