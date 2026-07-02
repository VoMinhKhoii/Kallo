/// Dashboard design tokens — the flat, high-contrast system (2026 redesign).
///
/// The dashboard deliberately diverges from the web's "Apple Notes on cream
/// paper" port. The palette is unchanged (cream / espresso / tan); what changed
/// is the APPLICATION: solid surfaces (no stacked translucency), ONE sans
/// family (Be Vietnam Pro) on a 5-size scale, exactly 3 text colors, one card
/// radius.
///
/// Threads-style typography test (2026): compacter sizes, lighter weights, and
/// hierarchy carried by weight + colour rather than size — minimal tracking,
/// quiet muted labels. The one editorial serif greeting is kept. Reference:
/// Threads (calm feed) + Apple Health (labels recede) + getdesign.md. The
/// throughline — hierarchy comes from contrast + weight, not from loud type.
library;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../theme/nham_typography.dart';

// ── Surfaces (all solid, 100% opacity) ───────────────────────────────────
const Color kPage = Color(0xFFFEFBF6); // app page — paper cream
const Color kCardSurface = Color(0xFFFFFFFF); // cards — solid white
const Color kTrack = Color(0xFFF1EFE9); // ring/bar tracks — the ONLY low-contrast surface
const Color kHairline = Color(0xFFE8D5B5); // the one border (biscotti, solid)
const Color kFieldFill = Color(0xFFF6F1E8); // soft warm fill for inputs

// ── Text colours — the dashboard uses exactly TWO (Threads: black + grey) ──
const Color kInk = Color(0xFF2C2416); // espresso "black" — primary data
// Canonical calm secondary: ONE warm neutral grey for every secondary role
// (labels, units, captions, meta, dates). This is the mobile design-system
// secondary text colour going forward — reach for this, not the legacy pair.
const Color kInkMuted = Color(0xFF8C867C);
// Legacy warm taupe / stone — still consumed by the not-yet-migrated Nutrition
// screens. The DASHBOARD no longer uses these; do not add new usages.
const Color kInkSecondary = Color(0xFF8B7355);
const Color kInkDisabled = Color(0xFFA8A29E);

// ── Shape ────────────────────────────────────────────────────────────────
const double kCardRadius = 22; // one card radius — modern iOS grouped-card feel

/// Layered espresso card shadow — a tight contact shadow plus a soft ambient
/// one. Two stacked shadows read like a real iOS card lifting off the warm page,
/// where one flat blur read as a smudge. Cards use shadow, not border.
const List<BoxShadow> kCardShadows = [
  BoxShadow(
    color: Color(0x142C2416), // ambient (~8%)
    blurRadius: 24,
    offset: Offset(0, 10),
  ),
  BoxShadow(
    color: Color(0x0F2C2416), // contact (~6%)
    blurRadius: 3,
    offset: Offset(0, 1),
  ),
];

/// Back-compat single shadow (some surfaces still reference it).
const BoxShadow kCardShadow = BoxShadow(
  color: Color(0x0F2C2416),
  blurRadius: 28,
  offset: Offset(0, 12),
);

const List<FontFeature> _tnum = [FontFeature.tabularFigures()];

// ── Type — Be Vietnam Pro only, 5 sizes (29 / 17 / 14 / 12 / 11) ──────────
// Threads / Apple Health calm: labels recede (muted taupe, never espresso),
// content is small + regular, hierarchy comes from weight + colour, not size.

/// 40 / 500 — the ONE hero number per card (calories remaining, weight).
/// Full size (the number is the point) but MEDIUM, not semibold — Be Vietnam
/// Pro reads heavy, so w500 keeps it prominent without the "thick" feel.
TextStyle dashHero({Color color = kInk}) => TextStyle(
      fontFamily: NhamTextStyles.sansFamily,
      fontSize: 40,
      fontWeight: FontWeight.w500,
      height: 1.0,
      letterSpacing: -1.0,
      color: color,
      fontFeatures: _tnum,
    );

/// 17 / 500 — ring-center number, macro gram values, metric values.
TextStyle dashValue({Color color = kInk}) => TextStyle(
      fontFamily: NhamTextStyles.sansFamily,
      fontSize: 17,
      fontWeight: FontWeight.w500,
      height: 1.1,
      color: color,
      fontFeatures: _tnum,
    );

/// 14 / 400·500 — meal names, callout detail, the "/ target" denominator.
TextStyle dashBody({
  Color color = kInk,
  FontWeight weight = FontWeight.w400,
  bool tabular = false,
}) =>
    TextStyle(
      fontFamily: NhamTextStyles.sansFamily,
      fontSize: 14,
      fontWeight: weight,
      height: 1.45,
      color: color,
      fontFeatures: tabular ? _tnum : null,
    );

/// 12 / 400 — secondary captions, stat values (quiet, Threads-light meta).
TextStyle dashMeta({Color color = kInkMuted, bool tabular = false}) =>
    TextStyle(
      fontFamily: NhamTextStyles.sansFamily,
      fontSize: 12,
      fontWeight: FontWeight.w400,
      height: 1.35,
      color: color,
      fontFeatures: tabular ? _tnum : null,
    );

/// 11 / 500 — ALL-CAPS labels (PROTEIN/CARBS/FAT, section headers). Quiet:
/// muted taupe by default, medium weight, minimal tracking — they structure the
/// screen without shouting. Callers should NOT force espresso (kInk) here;
/// let labels recede so the data reads first (the Apple Health move).
TextStyle dashEyebrow({
  Color color = kInkMuted,
  FontWeight weight = FontWeight.w500,
}) =>
    TextStyle(
      fontFamily: NhamTextStyles.sansFamily,
      fontSize: 11,
      fontWeight: weight,
      height: 1.3,
      letterSpacing: 0.3,
      color: color,
    );

/// Lora 22 / 400 — the single editorial serif moment per viewport (greeting).
/// Serif appears ONCE, never bold, never repeated (the Anthropic-greeting rule).
TextStyle dashHeadline({Color color = kInk}) => GoogleFonts.lora(
      fontSize: 22,
      fontWeight: FontWeight.w400,
      height: 1.2,
      letterSpacing: -0.3,
      color: color,
    );
