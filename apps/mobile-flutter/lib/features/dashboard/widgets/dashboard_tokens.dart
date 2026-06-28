/// Dashboard design tokens — the flat, high-contrast system (2026 redesign).
///
/// The dashboard deliberately diverges from the web's "Apple Notes on cream
/// paper" port. The palette is unchanged (cream / espresso / tan); what changed
/// is the APPLICATION: solid surfaces (no stacked translucency), ONE sans
/// family (Be Vietnam Pro) on a 5-size scale, exactly 3 text colors, one card
/// radius,
/// and serif reserved for a single editorial headline per viewport.
///
/// Reference: getdesign.md (Anthropic/Notion/Linear) + CalAI. The throughline —
/// hierarchy comes from contrast + size, not from a dozen faint tints.
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

// ── Text — exactly 3 colors, all 100% opacity ────────────────────────────
const Color kInk = Color(0xFF2C2416); // espresso — primary data
const Color kInkSecondary = Color(0xFF8B7355); // warm taupe — labels/units/captions
const Color kInkDisabled = Color(0xFFA8A29E); // stone — disabled metadata ≥13px ONLY

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

// ── Type — Be Vietnam Pro only, 5 sizes (40 / 20 / 15 / 13 / 11) ──────────

/// 40 / 600 — the ONE hero number per card (calories remaining, weight).
TextStyle dashHero({Color color = kInk}) => TextStyle(
      fontFamily: NhamTextStyles.sansFamily,
      fontSize: 40,
      fontWeight: FontWeight.w600,
      height: 1.0,
      letterSpacing: -1.2,
      color: color,
      fontFeatures: _tnum,
    );

/// 20 / 600 — ring-center number, macro gram values, metric values.
TextStyle dashValue({Color color = kInk}) => TextStyle(
      fontFamily: NhamTextStyles.sansFamily,
      fontSize: 20,
      fontWeight: FontWeight.w600,
      height: 1.1,
      color: color,
      fontFeatures: _tnum,
    );

/// 15 / 400·500 — meal names, callout detail, the "/ target" denominator.
TextStyle dashBody({
  Color color = kInk,
  FontWeight weight = FontWeight.w400,
  bool tabular = false,
}) =>
    TextStyle(
      fontFamily: NhamTextStyles.sansFamily,
      fontSize: 15,
      fontWeight: weight,
      height: 1.4,
      color: color,
      fontFeatures: tabular ? _tnum : null,
    );

/// 13 / 500 — secondary captions, stat values.
TextStyle dashMeta({Color color = kInkSecondary, bool tabular = false}) =>
    TextStyle(
      fontFamily: NhamTextStyles.sansFamily,
      fontSize: 13,
      fontWeight: FontWeight.w500,
      height: 1.35,
      color: color,
      fontFeatures: tabular ? _tnum : null,
    );

/// 11 / 700 — ALL-CAPS labels (PROTEIN/CARBS/FAT, section headers, LEFT).
TextStyle dashEyebrow({
  Color color = kInkSecondary,
  FontWeight weight = FontWeight.w700,
}) =>
    TextStyle(
      fontFamily: NhamTextStyles.sansFamily,
      fontSize: 11,
      fontWeight: weight,
      height: 1.3,
      letterSpacing: 1.5,
      color: color,
    );

/// Lora 22 / 400 — the single editorial serif moment per viewport (week title).
/// Serif appears ONCE, never bold, never repeated (the Anthropic-greeting rule).
TextStyle dashHeadline({Color color = kInk}) => GoogleFonts.lora(
      fontSize: 22,
      fontWeight: FontWeight.w400,
      height: 1.2,
      letterSpacing: -0.3,
      color: color,
    );
