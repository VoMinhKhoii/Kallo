import 'dart:ui';

/// The Nham design system color palette.
///
/// Transcribed from the web's `globals.css` `:root` tokens (the canonical
/// `--nham-*` values). Visual direction: "Apple Notes on cream paper."
abstract final class NhamColors {
  // ── Core surfaces ────────────────────────────────────────────────────
  static const Color surface = Color(0xFFFEFBF6); // app background — paper cream
  static const Color elev = Color(0xFFFFFFFF); // cards / sheets
  static const Color hover = Color(0xFFF0EAE0);
  static const Color track = Color(0xFFF5F4F0);

  // ── Text ─────────────────────────────────────────────────────────────
  static const Color text = Color(0xFF2C2416); // espresso
  static const Color textMuted = Color(0xFF8B7355); // warm taupe
  static const Color textSoft = Color(0xFF6B5D4F);

  // ── Accent ───────────────────────────────────────────────────────────
  static const Color accent = Color(0xFFC9A87C); // signature tan
  static const Color accentDark = Color(0xFFB89968);

  // ── Borders ──────────────────────────────────────────────────────────
  static const Color border = Color(0xFFE8D5B5); // biscotti hairline
  static const Color borderSoft = Color(0x99E8D5B5); // biscotti @ 60%
  static const Color borderHalf = Color(0x80E8D5B5); // biscotti @ 50%
  static const Color borderFaint = Color(0x4DE8D5B5); // biscotti @ 30%
  static const Color borderBiscotti40 = Color(0x66E8D5B5); // biscotti @ 40%

  // ── Translucent surfaces ─────────────────────────────────────────────
  static const Color elevTranslucent = Color(0xCCFFFFFF); // card/elev @ 80%
  static const Color surface80 = Color(0xCCFEFBF6); // surface cream @ 80%
  static const Color cardWhite55 = Color(0x8CFFFFFF); // card white @ 55%
  static const Color cardWhite40 = Color(0x66FFFFFF); // card white @ 40%
  static const Color cardWhite30 = Color(0x4DFFFFFF); // card white @ 30%

  // ── Accent alpha variants ────────────────────────────────────────────
  static const Color accent05 = Color(0x0DC9A87C); // 5%
  static const Color accent07 = Color(0x12C9A87C); // 7%
  static const Color accent10 = Color(0x1AC9A87C); // 10% — selected fill
  static const Color accent15 = Color(0x26C9A87C); // 15%
  static const Color accent20 = Color(0x33C9A87C); // 20% — hero divider
  static const Color accent30 = Color(0x4DC9A87C); // 30% — timeline dot fill
  static const Color accent35 = Color(0x59C9A87C); // 35%
  static const Color accent40 = Color(0x66C9A87C); // 40% — input focus border
  static const Color accent50 = Color(0x80C9A87C); // 50% — selected border
  static const Color accent60 = Color(0x99C9A87C); // 60%

  // ── Accent alias names (same values, semantic intent) ────────────────
  static const Color accentSelectedFill = accent10;
  static const Color accentSelectedBorder = accent50;
  static const Color borderAccent40 = accent40;
  static const Color timelineDotFill = accent30;

  // ── Button ───────────────────────────────────────────────────────────
  static const Color btn = Color(0xFF695E4E); // solid CTA — warm umber
  static const Color btnHover = Color(0xFF5A5043);
  static const Color btnBorderGhost = Color(0x66695E4E); // btn umber @ 40%

  // ── Stone (cool gray) ───────────────────────────────────────────────
  static const Color stone = Color(0xFFA8A29E);
  static const Color stone50 = Color(0x80A8A29E); // 50%
  static const Color stone70 = Color(0xB3A8A29E); // 70%

  // ── Text alpha variants ──────────────────────────────────────────────
  static const Color text40 = Color(0x662C2416); // 40%
  static const Color textMuted50 = Color(0x808B7355); // 50%
  static const Color textMuted60 = Color(0x998B7355); // 60%
  static const Color textMuted70 = Color(0xB38B7355); // 70% — macro-bar labels
  static const Color textMuted80 = Color(0xCC8B7355); // 80% — legacy-macro note
  static const Color placeholderMuted40 = Color(0x668B7355); // 40%

  // ── Hover alpha variants ─────────────────────────────────────────────
  static const Color hover40 = Color(0x66F0EAE0); // 40%
  static const Color hover50 = Color(0x80F0EAE0); // 50%

  // ── Danger alpha variant ─────────────────────────────────────────────
  static const Color danger70 = Color(0xB3D37B69); // 70%

  // ── Macros ───────────────────────────────────────────────────────────
  static const Color macroProtein = Color(0xFFC9A87C);
  static const Color macroCarbs = Color(0xFF8B7355);
  static const Color macroFat = Color(0xFFA8A29E);

  // ── Status ───────────────────────────────────────────────────────────
  static const Color success = Color(0xFF7CA368); // sage (heatmap/legacy)
  // Fresh emerald for "on target" cards — brighter + cleaner than the olive
  // sage, reads modern against the warm cream surface.
  static const Color successAccent = Color(0xFF1FA971); // emerald — text + bar
  static const Color successDark = Color(0xFF14855A); // deeper emerald — figures
  static const Color successFaint = Color(0xFFEAF7F0); // mint — met-card fill
  static const Color successBorder = Color(0x331FA971); // emerald @ 20% — hairline
  static const Color danger = Color(0xFFD37B69); // terracotta

  // ── Adherence heatmap diverging scale ────────────────────────────────
  static const Color heatmapOnTarget = Color(0xFF7CA368);
  static const Color heatmapClose = Color(0xFFA6C495);
  static const Color heatmapSlight = Color(0xFFD4C9AD);
  static const Color heatmapModerate = Color(0xFFE09C84);
  static const Color heatmapFar = Color(0xFFD37B69);
  static const Color heatmapBarMiss = Color(0xFFD4C9AD);

  // ── Settings + onboarding neutral/cream palette ──────────────────────
  static const Color inputBorder = Color(0xFFEAE7E0);
  static const Color inputBorder40 = Color(0x66EAE7E0);
  static const Color textWarm = Color(0xFF7B6F62);
  static const Color textHelp = Color(0xFF8B8682);
  static const Color textSelected = Color(0xFF6F6556);
  static const Color cream = Color(0xFFFDFCF8);
  static const Color cream95 = Color(0xF2FDFCF8); // 95%
  static const Color cardCream = Color(0xFFFFFCF8);
  static const Color selectedCard = Color(0xFFFFF8EF);
  static const Color selectedSegment = Color(0xFFFBF2E6);
  static const Color btnDarkHover = Color(0xFF1C1917);
  static const Color btnDarkHover2 = Color(0xFF3D3425);
}
