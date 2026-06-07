/// Dashboard design tokens — the flat, high-contrast system (2026 redesign).
///
/// The dashboard deliberately diverges from the web's "Apple Notes on cream
/// paper" port. The palette is unchanged (cream / espresso / tan); what changed
/// is the APPLICATION: solid surfaces (no stacked translucency), ONE sans
/// family (DM Sans) on a 5-size scale, exactly 3 text colors, one card radius,
/// and serif reserved for a single editorial headline per viewport.
///
/// Reference: getdesign.md (Anthropic/Notion/Linear) + CalAI. The throughline —
/// hierarchy comes from contrast + size, not from a dozen faint tints.
library;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// ── Surfaces (all solid, 100% opacity) ───────────────────────────────────
const Color kPage = Color(0xFFFEFBF6); // app page — paper cream
const Color kCardSurface = Color(0xFFFFFFFF); // cards — solid white
const Color kTrack = Color(0xFFF5F4F0); // ring/bar tracks — the ONLY low-contrast surface
const Color kHairline = Color(0xFFE8D5B5); // the one border (biscotti, solid)

// ── Text — exactly 3 colors, all 100% opacity ────────────────────────────
const Color kInk = Color(0xFF2C2416); // espresso — primary data
const Color kInkSecondary = Color(0xFF8B7355); // warm taupe — labels/units/captions
const Color kInkDisabled = Color(0xFFA8A29E); // stone — disabled metadata ≥13px ONLY

// ── Shape ────────────────────────────────────────────────────────────────
const double kCardRadius = 16; // one card radius (was a 24/20/16 mix)

/// The soft espresso card shadow (espresso @5%). Cards use shadow, not border.
const BoxShadow kCardShadow = BoxShadow(
  color: Color(0x0D2C2416),
  blurRadius: 32,
  offset: Offset(0, 10),
);

const List<FontFeature> _tnum = [FontFeature.tabularFigures()];

// ── Type — DM Sans only, 5 sizes (40 / 20 / 15 / 13 / 11) ─────────────────

/// 40 / 600 — the ONE hero number per card (calories remaining, weight).
TextStyle dashHero({Color color = kInk}) => GoogleFonts.dmSans(
      fontSize: 40,
      fontWeight: FontWeight.w600,
      height: 1.0,
      letterSpacing: -1.2,
      color: color,
      fontFeatures: _tnum,
    );

/// 20 / 600 — ring-center number, macro gram values, metric values.
TextStyle dashValue({Color color = kInk}) => GoogleFonts.dmSans(
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
    GoogleFonts.dmSans(
      fontSize: 15,
      fontWeight: weight,
      height: 1.4,
      color: color,
      fontFeatures: tabular ? _tnum : null,
    );

/// 13 / 500 — secondary captions, stat values.
TextStyle dashMeta({Color color = kInkSecondary, bool tabular = false}) =>
    GoogleFonts.dmSans(
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
    GoogleFonts.dmSans(
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
