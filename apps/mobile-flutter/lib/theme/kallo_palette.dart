import 'dart:ui';

/// What the person picked in Settings → Appearance, stored per device.
/// [system] follows the phone: light ↔ [KalloPaletteId.dark].
enum KalloThemeChoice { system, light, dark, aurora }

/// The palette actually painted — a [KalloThemeChoice] after resolving
/// [KalloThemeChoice.system] against the phone's brightness.
enum KalloPaletteId { light, dark, aurora }

/// Every colour token [KalloColors] exposes, for one palette.
///
/// [KalloColors] reads [current] on every access, so a palette switch is one
/// assignment plus a rebuild (`theme_controller.dart`). Nothing may cache a
/// token in a `const` or a `final` that outlives a build: it would keep the
/// palette that was current when it was first read.
///
/// Only the BASE tokens are passed in. Every alpha variant and alias is
/// derived in the initializer list from its own palette's base at the light
/// palette's alpha — a dark `accent10` is the dark accent at 10% — so no ramp
/// can fade toward another palette's hue. `kallo_palette_test.dart` pins
/// [light] to the literal values the app shipped before palettes existed.
class KalloPalette {
  KalloPalette._({
    required this.isDark,
    required this.surface,
    required this.elev,
    required this.hover,
    required this.track,
    required this.text,
    required this.textMuted,
    required this.textSoft,
    required this.accent,
    required this.accentDark,
    required this.bandSurface,
    required this.bandForeground,
    required this.mention,
    required this.premiumChipFill,
    required this.premiumChipBorder,
    required this.premiumChipText,
    required this.premiumDot,
    required this.border,
    required this.btnPrimary,
    required this.btnPrimarySoft,
    required this.btn,
    required this.btnHover,
    required this.stone,
    required this.pressWash,
    required this.scrim,
    required this.pressWashOnInk,
    required this.pressWashOnGold,
    required this.dangerHover,
    required this.cheatMark,
    required this.macroProtein,
    required this.macroCarbs,
    required this.macroFat,
    required this.chartMuted,
    required this.success,
    required this.successAccent,
    required this.successDark,
    required this.successFaint,
    required this.danger,
    required this.offTarget,
    required this.heatmapOnTarget,
    required this.heatmapClose,
    required this.heatmapSlight,
    required this.heatmapModerate,
    required this.heatmapFar,
    required this.heatmapBarMiss,
    required this.inputBorder,
    required this.textWarm,
    required this.textHelp,
    required this.textSelected,
    required this.cream,
    required this.cardCream,
    required this.selectedCard,
    required this.selectedSegment,
    required this.btnDarkHover,
    required this.btnDarkHover2,
  }) : track50 = track.withAlpha(0x80),
       bandForeground70 = bandForeground.withAlpha(0xB3),
       borderSoft = border.withAlpha(0x99),
       borderHalf = border.withAlpha(0x80),
       borderFaint = border.withAlpha(0x4D),
       borderBiscotti40 = border.withAlpha(0x66),
       border70 = border.withAlpha(0xB3),
       border15 = border.withAlpha(0x26),
       elevTranslucent = elev.withAlpha(0xCC),
       surface80 = surface.withAlpha(0xCC),
       surface0 = surface.withAlpha(0x00),
       surface35 = surface.withAlpha(0x59),
       surface85 = surface.withAlpha(0xD9),
       cardWhite55 = elev.withAlpha(0x8C),
       cardWhite40 = elev.withAlpha(0x66),
       cardWhite30 = elev.withAlpha(0x4D),
       accent05 = accent.withAlpha(0x0D),
       accent07 = accent.withAlpha(0x12),
       accent10 = accent.withAlpha(0x1A),
       accent15 = accent.withAlpha(0x26),
       accent20 = accent.withAlpha(0x33),
       accent30 = accent.withAlpha(0x4D),
       accent35 = accent.withAlpha(0x59),
       accent40 = accent.withAlpha(0x66),
       accent50 = accent.withAlpha(0x80),
       accent60 = accent.withAlpha(0x99),
       accentSelectedFill = accent.withAlpha(0x1A),
       accentSelectedBorder = accent.withAlpha(0x80),
       borderAccent40 = accent.withAlpha(0x66),
       timelineDotFill = accent.withAlpha(0x4D),
       btnBorderGhost = btn.withAlpha(0x66),
       stone50 = stone.withAlpha(0x80),
       stone70 = stone.withAlpha(0xB3),
       text40 = text.withAlpha(0x66),
       text30 = text.withAlpha(0x4D),
       text25 = text.withAlpha(0x40),
       textMuted50 = textMuted.withAlpha(0x80),
       textMuted60 = textMuted.withAlpha(0x99),
       textMuted70 = textMuted.withAlpha(0xB3),
       textMuted80 = textMuted.withAlpha(0xCC),
       placeholderMuted40 = textMuted.withAlpha(0x66),
       hover40 = hover.withAlpha(0x66),
       hover50 = hover.withAlpha(0x80),
       danger70 = danger.withAlpha(0xB3),
       danger30 = danger.withAlpha(0x4D),
       danger10 = danger.withAlpha(0x1A),
       danger06 = danger.withAlpha(0x0F),
       chartProtein = macroProtein,
       chartCarbs = macroCarbs,
       chartFat = macroFat,
       successBorder = successAccent.withAlpha(0x33),
       offTarget70 = offTarget.withAlpha(0xB3),
       inputBorder40 = inputBorder.withAlpha(0x66),
       cream95 = cream.withAlpha(0xF2);

  /// Whether this palette paints light content on a dark canvas — drives the
  /// Material/Cupertino brightness and the status-bar content colour.
  final bool isDark;

  // One field per [KalloColors] token, same names, same groups.
  final Color surface, elev, hover, track, track50;
  final Color text, textMuted, textSoft, accent, accentDark;
  final Color bandSurface, bandForeground, bandForeground70, mention;
  final Color premiumChipFill, premiumChipBorder, premiumChipText, premiumDot;
  final Color border, borderSoft, borderHalf, borderFaint, borderBiscotti40;
  final Color border70, border15;
  final Color elevTranslucent, surface80, surface0, surface35, surface85;
  final Color cardWhite55, cardWhite40, cardWhite30;
  final Color accent05, accent07, accent10, accent15, accent20, accent30;
  final Color accent35, accent40, accent50, accent60;
  final Color accentSelectedFill, accentSelectedBorder, borderAccent40;
  final Color timelineDotFill;
  final Color btnPrimary, btnPrimarySoft, btn, btnHover, btnBorderGhost;
  final Color stone, stone50, stone70, text40, text30, text25;
  final Color textMuted50, textMuted60, textMuted70, textMuted80;
  final Color placeholderMuted40, hover40, hover50;
  final Color pressWash, scrim, pressWashOnInk, pressWashOnGold;
  final Color dangerHover, danger70, danger30, danger10, danger06, cheatMark;
  final Color macroProtein, macroCarbs, macroFat;
  final Color chartProtein, chartCarbs, chartFat, chartMuted;
  final Color success, successAccent, successDark, successFaint;
  final Color successBorder, danger, offTarget, offTarget70;
  final Color heatmapOnTarget, heatmapClose, heatmapSlight, heatmapModerate;
  final Color heatmapFar, heatmapBarMiss;
  final Color inputBorder, inputBorder40, textWarm, textHelp, textSelected;
  final Color cream, cream95, cardCream, selectedCard, selectedSegment;
  final Color btnDarkHover, btnDarkHover2;

  /// The palette every [KalloColors] getter reads. Written only through
  /// [apply] — by `main()` before the first frame, then by the theme
  /// controller.
  static KalloPalette current = light;
  static KalloPaletteId currentId = KalloPaletteId.light;

  static KalloPalette byId(KalloPaletteId id) => switch (id) {
    KalloPaletteId.light => light,
    KalloPaletteId.dark => dark,
    KalloPaletteId.aurora => aurora,
  };

  /// Makes [id] the current palette. Repainting is the caller's job.
  static void apply(KalloPaletteId id) {
    current = byId(id);
    currentId = id;
  }

  /// Today's palette, value for value.
  static final KalloPalette light = KalloPalette._(
    isDark: false,
    surface: const Color(0xFFF8F7F4),
    elev: const Color(0xFFFFFFFF),
    hover: const Color(0xFFF0EAE0),
    track: const Color(0xFFEDECE7),
    text: const Color(0xFF141413),
    textMuted: const Color(0xFF7A7870),
    textSoft: const Color(0xFF3D3D3A),
    accent: const Color(0xFFC9A87C),
    accentDark: const Color(0xFFB89968),
    bandSurface: const Color(0xFF6E6D66),
    bandForeground: const Color(0xFFFFFFFF),
    mention: const Color(0xFF2B72C6),
    premiumChipFill: const Color(0xFFF5F8FE),
    premiumChipBorder: const Color(0xFFA9C1F0),
    premiumChipText: const Color(0xFF2F5FD0),
    premiumDot: const Color(0xFF3B6FE0),
    border: const Color(0xFFE2DFD4),
    btnPrimary: const Color(0xFF141413),
    btnPrimarySoft: const Color(0xFFF0EAE0),
    btn: const Color(0xFF695E4E),
    btnHover: const Color(0xFF5A5043),
    stone: const Color(0xFFA8A29E),
    pressWash: const Color(0x0F141413),
    scrim: const Color(0x80000000),
    pressWashOnInk: const Color(0x1FFFFFFF),
    pressWashOnGold: const Color(0x1F141413),
    dangerHover: const Color(0xFFB81717),
    cheatMark: const Color(0xFF8B7355),
    macroProtein: const Color(0xFFD46A86),
    macroCarbs: const Color(0xFFE09C84),
    macroFat: const Color(0xFFE8C55C),
    chartMuted: const Color(0xFFCFCCC4),
    success: const Color(0xFF7CA368),
    successAccent: const Color(0xFF1FA971),
    successDark: const Color(0xFF14855A),
    successFaint: const Color(0xFFEAF7F0),
    danger: const Color(0xFFD11A1A),
    offTarget: const Color(0xFFD37B69),
    heatmapOnTarget: const Color(0xFF7CA368),
    heatmapClose: const Color(0xFFA6C495),
    heatmapSlight: const Color(0xFFD4C9AD),
    heatmapModerate: const Color(0xFFE09C84),
    heatmapFar: const Color(0xFFD37B69),
    heatmapBarMiss: const Color(0xFFD4C9AD),
    inputBorder: const Color(0xFFE2DFD4),
    textWarm: const Color(0xFF7B6F62),
    textHelp: const Color(0xFF8B8682),
    textSelected: const Color(0xFF6F6556),
    cream: const Color(0xFFFDFCF8),
    cardCream: const Color(0xFFFFFCF8),
    selectedCard: const Color(0xFFFFF8EF),
    selectedSegment: const Color(0xFFFBF2E6),
    btnDarkHover: const Color(0xFF1C1917),
    btnDarkHover2: const Color(0xFF3D3425),
  );

  /// "Dark" in the UI — the Graphite design. Text tokens hold 4.5:1 on both
  /// [surface] and [elev] ([textMuted] included, unlike light's).
  static final KalloPalette dark = KalloPalette._(
    isDark: true,
    surface: const Color(0xFF0F0F0E),
    elev: const Color(0xFF1C1C1A),
    hover: const Color(0xFF3D352B),
    track: const Color(0xFF2B2B28),
    text: const Color(0xFFF2F1EC),
    textMuted: const Color(0xFF93918A),
    textSoft: const Color(0xFFD9D7D0),
    accent: const Color(0xFFC9A87C),
    accentDark: const Color(0xFFB89968),
    bandSurface: const Color(0xFF3A3936),
    bandForeground: const Color(0xFFF2F1EC),
    mention: const Color(0xFF6FA8F0),
    premiumChipFill: const Color(0xFF18202E),
    premiumChipBorder: const Color(0xFF34507F),
    premiumChipText: const Color(0xFF93B4F7),
    premiumDot: const Color(0xFF6F9BF0),
    border: const Color(0xFF30302C),
    btnPrimary: const Color(0xFFF2F1EC),
    btnPrimarySoft: const Color(0xFF524636),
    btn: const Color(0xFFA8977B),
    btnHover: const Color(0xFF8F8068),
    stone: const Color(0xFF8F8A85),
    pressWash: const Color(0x14FFFFFF),
    scrim: const Color(0x99000000),
    pressWashOnInk: const Color(0x1FFFFFFF),
    pressWashOnGold: const Color(0x1F141413),
    dangerHover: const Color(0xFFE0554B),
    cheatMark: const Color(0xFFC9A87C),
    macroProtein: const Color(0xFFE07C96),
    macroCarbs: const Color(0xFFE7A68D),
    macroFat: const Color(0xFFEACB66),
    chartMuted: const Color(0xFF3A3936),
    success: const Color(0xFF6FA35C),
    successAccent: const Color(0xFF4FC892),
    successDark: const Color(0xFF4FC892),
    successFaint: const Color(0xFF13261C),
    danger: const Color(0xFFFF6A5F),
    offTarget: const Color(0xFFE08878),
    heatmapOnTarget: const Color(0xFF6FA35C),
    heatmapClose: const Color(0xFF4C6B42),
    heatmapSlight: const Color(0xFF5A5344),
    heatmapModerate: const Color(0xFFB9786A),
    heatmapFar: const Color(0xFFC9735F),
    heatmapBarMiss: const Color(0xFF5A5344),
    inputBorder: const Color(0xFF30302C),
    textWarm: const Color(0xFFA89B8B),
    textHelp: const Color(0xFF93918A),
    textSelected: const Color(0xFFD2C6B4),
    cream: const Color(0xFF0F0F0E),
    cardCream: const Color(0xFF252522),
    selectedCard: const Color(0xFF262119),
    selectedSegment: const Color(0xFF3D352B),
    btnDarkHover: const Color(0xFFD9D7D0),
    btnDarkHover2: const Color(0xFFBFBBB2),
  );

  /// Aurora — Dark's plum-tinted sibling. Same accents, macros, status and
  /// heatmap; its own neutrals. (The glow and the gradient button are the
  /// visual pass's, not the palette's.)
  static final KalloPalette aurora = KalloPalette._(
    isDark: true,
    surface: const Color(0xFF131114),
    elev: const Color(0xFF1E1B1F),
    hover: const Color(0xFF2C272D),
    track: const Color(0xFF2C282D),
    text: const Color(0xFFF4F0EC),
    textMuted: const Color(0xFF9C959C),
    textSoft: const Color(0xFFDCD6D8),
    accent: const Color(0xFFC9A87C),
    accentDark: const Color(0xFFB89968),
    bandSurface: const Color(0xFF3B353C),
    bandForeground: const Color(0xFFF4F0EC),
    mention: const Color(0xFF6FA8F0),
    premiumChipFill: const Color(0xFF1A1E2C),
    premiumChipBorder: const Color(0xFF34507F),
    premiumChipText: const Color(0xFF93B4F7),
    premiumDot: const Color(0xFF6F9BF0),
    border: const Color(0xFF332E34),
    btnPrimary: const Color(0xFFF4F0EC),
    btnPrimarySoft: const Color(0xFF524636),
    btn: const Color(0xFFA8977B),
    btnHover: const Color(0xFF8F8068),
    stone: const Color(0xFF8F8A85),
    pressWash: const Color(0x14FFFFFF),
    scrim: const Color(0x99000000),
    pressWashOnInk: const Color(0x1FFFFFFF),
    pressWashOnGold: const Color(0x1F141413),
    dangerHover: const Color(0xFFE0554B),
    cheatMark: const Color(0xFFC9A87C),
    macroProtein: const Color(0xFFE07C96),
    macroCarbs: const Color(0xFFE7A68D),
    macroFat: const Color(0xFFEACB66),
    chartMuted: const Color(0xFF3B353C),
    success: const Color(0xFF6FA35C),
    successAccent: const Color(0xFF4FC892),
    successDark: const Color(0xFF4FC892),
    successFaint: const Color(0xFF14251C),
    danger: const Color(0xFFFF6A5F),
    offTarget: const Color(0xFFE08878),
    heatmapOnTarget: const Color(0xFF6FA35C),
    heatmapClose: const Color(0xFF4C6B42),
    heatmapSlight: const Color(0xFF5A5344),
    heatmapModerate: const Color(0xFFB9786A),
    heatmapFar: const Color(0xFFC9735F),
    heatmapBarMiss: const Color(0xFF5A5344),
    inputBorder: const Color(0xFF332E34),
    textWarm: const Color(0xFFA89B8B),
    textHelp: const Color(0xFF9C959C),
    textSelected: const Color(0xFFD2C6B4),
    cream: const Color(0xFF131114),
    cardCream: const Color(0xFF28242A),
    selectedCard: const Color(0xFF262127),
    selectedSegment: const Color(0xFF2C272D),
    btnDarkHover: const Color(0xFFDCD6D8),
    btnDarkHover2: const Color(0xFFC2BCBE),
  );
}
