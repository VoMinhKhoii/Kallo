/// Calm design tokens — the mobile app's shared type/colour/spacing system.
///
/// Born on the dashboard (2026 redesign) and now the canonical system for the
/// whole Flutter app. The palette is a neutral canvas / ink / hairline system
/// (warm cream / espresso retired) with WARM interaction washes and the tan
/// accent kept for non-text moments; the APPLICATION is calm: solid surfaces
/// (no stacked translucency), ONE sans family (Be Vietnam Pro), exactly TWO
/// text colours, one card radius.
///
/// Threads / Apple-Health tuned: compact sizes, lighter weights, hierarchy
/// carried by weight + colour rather than size — minimal tracking, quiet muted
/// labels. One editorial serif moment (the greeting) per viewport. The
/// throughline — hierarchy comes from contrast + weight, not from loud type.
///
/// Canonical doc: `.agents/skills/nham-design/mobile.md`.
library;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'nham_typography.dart';

// ── Surfaces (all solid, 100% opacity) ───────────────────────────────────
const Color kPage = Color(0xFFF9F9F7); // app page — neutral canvas
const Color kCardSurface = Color(0xFFFFFFFF); // cards — solid white
const Color kTrack = Color(0xFFF5F4F0); // ring/bar tracks — the ONLY low-contrast surface (warm)
const Color kHairline = Color(0xFFE8E6DC); // the one border (neutral hairline, solid)
const Color kFieldFill = Color(0xFFFFFFFF); // input fills read white on the neutral canvas

// ── Text colours — the app uses exactly TWO (Threads: black + grey) ────────
const Color kInk = Color(0xFF141413); // near-black ink — primary data
// Canonical calm secondary: ONE warm neutral grey for every secondary role
// (labels, units, captions, meta, dates). This is the mobile design-system
// secondary text colour — the only secondary text colour there is.
const Color kInkMuted = Color(0xFF6E6D66);

// ── Shape ────────────────────────────────────────────────────────────────
const double kCardRadius = 22; // one card radius — modern iOS grouped-card feel

/// Layered ink card shadow — a tight contact shadow plus a soft ambient
/// one. Two stacked shadows read like a real iOS card lifting off the page,
/// where one flat blur read as a smudge. Cards use shadow, not border.
const List<BoxShadow> kCardShadows = [
  BoxShadow(
    color: Color(0x14141413), // ambient (~8%)
    blurRadius: 24,
    offset: Offset(0, 10),
  ),
  BoxShadow(
    color: Color(0x0F141413), // contact (~6%)
    blurRadius: 3,
    offset: Offset(0, 1),
  ),
];

/// Back-compat single shadow (some surfaces still reference it).
const BoxShadow kCardShadow = BoxShadow(
  color: Color(0x0F141413),
  blurRadius: 28,
  offset: Offset(0, 12),
);

const List<FontFeature> _tnum = [FontFeature.tabularFigures()];

// ── Type — Be Vietnam Pro only, 5 sizes (40 / 17 / 14 / 12 / 11) ──────────
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
