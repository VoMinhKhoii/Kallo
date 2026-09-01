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
/// Canonical doc: `.agents/skills/kallo-design/mobile.md`.
///
/// Colour values are NOT restated here: every surface/ink token DERIVES from
/// [KalloColors] (the single source of truth for the palette). This file owns
/// only the calm TYPE system + the semantic colour aliases (kPage, kInk, …)
/// that map design-system intent onto those canonical values.
library;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'kallo_colors.dart';
import 'kallo_typography.dart';

// ── Surfaces (all solid, 100% opacity) — semantic aliases onto KalloColors ──
const Color kPage = KalloColors.surface; // app page — neutral canvas
const Color kCardSurface = KalloColors.elev; // cards — solid white
// Tracks the canvas: whenever [kPage] moves, this moves with it by the same
// delta, or the "recessed" surface ends up lighter than the page it sits on.
const Color kTrack = KalloColors.track; // ring/bar tracks — the ONLY low-contrast surface (warm)
const Color kHairline = KalloColors.border; // the one border (neutral hairline, solid)
const Color kFieldFill = KalloColors.elev; // input fills read white on the neutral canvas

// ── Text colours — the app uses exactly TWO (Threads: black + grey) ────────
const Color kInk = KalloColors.text; // near-black ink — primary data
// Canonical calm secondary: ONE warm neutral grey for every secondary role
// (labels, units, captions, meta, dates). This is the mobile design-system
// secondary text colour — the only secondary text colour there is.
const Color kInkMuted = KalloColors.textMuted;

// ── Shape ────────────────────────────────────────────────────────────────
const double kCardRadius = 22; // one card radius — modern iOS grouped-card feel

/// Sheet/menu elevation shadows. On the `#F8F7F4` canvas (native pass,
/// 2026-08-31) ordinary cards separate by surface alone — NO border, NO
/// shadow. These shadows are reserved for TRUE elevation: sheets, menus, the
/// pill nav, a dragged card.
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

// ── Type — Be Vietnam Pro only (40 / 28 / 17 / 16 / 15 / 13 / 11) ─────────
// Threads-scale ramp (2026-09-01). Measured against Threads on iOS: body 17,
// names 16 semibold, secondary 15, captions 13 by exception. Labels still
// recede (muted grey, regular weight) and hierarchy is still carried by weight
// + colour — but the ramp now sits at iOS-native sizes rather than below them.
// The density Threads has comes from a narrow measure and controlled leading,
// which this system keeps; it never came from small type.

/// 40 / 500 — the ONE hero number per card (calories remaining, weight).
/// Full size (the number is the point) but MEDIUM, not semibold — Be Vietnam
/// Pro reads heavy, so w500 keeps it prominent without the "thick" feel.
TextStyle dashHero({Color color = kInk}) => TextStyle(
      fontFamily: KalloTextStyles.sansFamily,
      fontSize: 40,
      fontWeight: FontWeight.w500,
      height: 1.0,
      letterSpacing: -1.0,
      color: color,
      fontFeatures: _tnum,
    );

/// 17 / 500 — ring-center number, macro gram values, metric values.
TextStyle dashValue({Color color = kInk}) => TextStyle(
      fontFamily: KalloTextStyles.sansFamily,
      fontSize: 17,
      fontWeight: FontWeight.w500,
      height: 1.1,
      color: color,
      fontFeatures: _tnum,
    );

/// 17 / 400·500 — the app's reading size: meal names, post bodies, list-row
/// labels, composer input, button labels.
///
/// Threads-scale (2026-09-01). Measured against Threads on iOS, whose feed
/// body is NOT small — its density comes from a narrow measure and controlled
/// leading, not from tiny type. The old 14 read undersized next to it and
/// below every iOS system surface (a Settings row label is 17). Leading 1.35
/// (~23pt) is the Threads relationship: enough air for two-line wraps without
/// the paragraph feel 1.5 would bring.
TextStyle dashBody({
  Color color = kInk,
  FontWeight weight = FontWeight.w400,
  bool tabular = false,
}) =>
    TextStyle(
      fontFamily: KalloTextStyles.sansFamily,
      fontSize: 17,
      fontWeight: weight,
      height: 1.35,
      color: color,
      fontFeatures: tabular ? _tnum : null,
    );

/// 16 / 600 — an emphasised NAME sitting directly against 17 body copy: the
/// Circle post author over the post text, a reply author over the reply.
///
/// Threads-scale (2026-09-01). Two 17s stacked — a w600 name over a w400 body
/// — read as a wall; stepping the name down one notch while taking it up to
/// semibold keeps the identity/content relationship without the collision.
/// This tier is for identity ONLY. A label that IS the row's body (a Settings
/// row label, a button, a sheet title) stays at 17 — see [dashBody] and
/// [kSectionHeader].
TextStyle dashName({Color color = kInk}) => TextStyle(
      fontFamily: KalloTextStyles.sansFamily,
      fontSize: 16,
      fontWeight: FontWeight.w600,
      height: 1.3,
      color: color,
    );

/// 15 / 400 — the secondary tier: timestamps, units, quiet values, captions.
/// Leading 1.25 — meta lines are short and rarely wrap; the extra leading only
/// grew the rows around them.
///
/// Threads-scale (2026-09-01), 12 → 15. At 12 against a 17 body the meta line
/// had fallen out of the type system and read as fine print; 15 keeps it
/// clearly subordinate (colour + size) while staying legible at arm's length.
///
/// [weight] exists for the one case where Meta is NOT secondary: a section
/// header in ink. At w400 it reads as small body text sitting above the rows
/// rather than labelling them, since size is then the only thing separating it
/// from a body label of the same colour.
TextStyle dashMeta({
  Color color = kInkMuted,
  FontWeight weight = FontWeight.w400,
  bool tabular = false,
}) =>
    TextStyle(
      fontFamily: KalloTextStyles.sansFamily,
      fontSize: 15,
      fontWeight: weight,
      height: 1.25,
      color: color,
      fontFeatures: tabular ? _tnum : null,
    );

/// 13 / 400·500 — the caption tier, COMPONENT-INTERNAL ONLY.
///
/// Threads-scale (2026-09-01) introduced this as the escape hatch for compact
/// components that 15 visibly breaks: a fixed-width chip, a legend crammed
/// under an icon, a number pinned inside a gauge. It is NOT a general
/// secondary tier — reach for [dashMeta] first, and only drop here when the
/// component measurably overflows. Every use is justified at its call site.
TextStyle dashCaption({
  Color color = kInkMuted,
  FontWeight weight = FontWeight.w400,
  bool tabular = false,
}) =>
    TextStyle(
      fontFamily: KalloTextStyles.sansFamily,
      fontSize: 13,
      fontWeight: weight,
      height: 1.25,
      color: color,
      fontFeatures: tabular ? _tnum : null,
    );

/// 11 / 500 — ALL-CAPS labels, COMPONENT-INTERNAL ONLY (the macro dial
/// PROTEIN/CARBS/FAT eyebrows). Retired as a section header in the native
/// pass (2026-08-31): visible section headers are mixed-case ink — use
/// [kSectionHeader] (17/600) or [kGroupLabel] (14/500 muted) instead.
TextStyle dashEyebrow({
  Color color = kInkMuted,
  FontWeight weight = FontWeight.w500,
}) =>
    TextStyle(
      fontFamily: KalloTextStyles.sansFamily,
      fontSize: 11,
      fontWeight: weight,
      height: 1.3,
      letterSpacing: 0.3,
      color: color,
    );

/// Lora 22 / 400 — the single editorial serif moment per viewport. The
/// dashboard's serif slot is now the "Kallo" wordmark (2026-09-01), set at 28;
/// this stays for editorial moments inside a screen.
/// 17 / 600 — the page title on the header line.
///
/// Sans, not the Lora [dashHeadline] this replaced on headers: at 17 its
/// cap-height sits level with the 24pt glyphs flanking it, and a screen then
/// spends none of its three sizes on chrome. Lora stays for editorial moments
/// INSIDE a screen — the first-run question, an empty state — so the serif is
/// still in the app, just not in its furniture.
TextStyle dashPageTitle({Color color = kInk}) => TextStyle(
      fontFamily: KalloTextStyles.sansFamily,
      fontSize: 17,
      fontWeight: FontWeight.w600,
      height: 1.2,
      letterSpacing: -0.3,
      color: color,
    );

/// Serif appears ONCE, never bold, never repeated (the Anthropic-greeting rule).
TextStyle dashHeadline({Color color = kInk}) => GoogleFonts.lora(
      fontSize: 22,
      fontWeight: FontWeight.w400,
      height: 1.2,
      letterSpacing: -0.3,
      color: color,
    );

// ── Header ramp (native pass, 2026-08-31 — Threads scale) ─────────────────
// page title 28/700 → section header 17/600 (optional 12 muted meta right) →
// group label 14/500 muted (Settings-style card qualifier) → content.

/// 28 / 700 / -0.5 — the page title (Nutrition, Circle, Settings).
TextStyle kPageTitle({Color color = kInk}) => TextStyle(
      fontFamily: KalloTextStyles.sansFamily,
      fontSize: 28,
      fontWeight: FontWeight.w700,
      height: 1.15,
      letterSpacing: -0.5,
      color: color,
    );

/// 17 / 600 / -0.2 — section headers ("Vitamins", "Progress", "Recent
/// meals") and centered sheet titles. Same metrics as [dashPageTitle], which
/// keeps that role on header lines.
TextStyle kSectionHeader({Color color = kInk}) => TextStyle(
      fontFamily: KalloTextStyles.sansFamily,
      fontSize: 17,
      fontWeight: FontWeight.w600,
      height: 1.2,
      letterSpacing: -0.2,
      color: color,
    );

/// 15 / 500 muted — group labels above grouped cards ("Targets",
/// "Preferences", "Today"). Moved 14 → 15 with the Threads-scale ramp so it
/// sits on the secondary tier ([dashMeta]) rather than between tiers.
TextStyle kGroupLabel({Color color = kInkMuted}) => TextStyle(
      fontFamily: KalloTextStyles.sansFamily,
      fontSize: 15,
      fontWeight: FontWeight.w500,
      height: 1.3,
      color: color,
    );

// ── Pill nav (native pass, 2026-08-31) ────────────────────────────────────
/// Gap from each screen edge to the floating pill nav.
///
/// The bar has NO width of its own — it fills whatever this leaves, so it
/// adapts to the device instead of pinning one phone's number. It replaced
/// `kNavWidth = 358` (a 390pt iPhone less a 16pt gutter each side), which on
/// any wider screen left the capsule stranded mid-screen with its five targets
/// bunched into the middle of it.
///
/// 8, not 0: the capsule still has to read as an object floating over the
/// content — it needs a sliver of canvas to clear and to catch the outer edge
/// of [kNavShadows]. Flush to the edge it stops being a pill and becomes a
/// bar, which is the thing this nav is deliberately not.
const double kNavInset = 8;
const double kNavHeight = 72;
const double kNavRadius = 36;
const double kNavAddSize = 52; // center "+" circle (beige, ink plus)

/// The bottom-sheet shadow — sheets are TRUE elevation and keep it even
/// though ordinary cards carry none.
const List<BoxShadow> kSheetShadows = [
  BoxShadow(
    color: Color(0x2E141413), // ~18%
    blurRadius: 30,
    offset: Offset(0, -8),
  ),
];

/// The pill nav's two-layer shadow (it is TRUE elevation, like a sheet).
const List<BoxShadow> kNavShadows = [
  BoxShadow(
    color: Color(0x24141413), // ~14%
    blurRadius: 30,
    offset: Offset(0, 10),
  ),
  BoxShadow(
    color: Color(0x0F141413), // ~6%
    blurRadius: 8,
    offset: Offset(0, 2),
  ),
];
