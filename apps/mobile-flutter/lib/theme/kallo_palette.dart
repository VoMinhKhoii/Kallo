import 'dart:ui';

part 'palette/kallo_palette_values.dart';

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
    required this.sheet,
    required this.sheetPeek,
    required this.sheetPeekInk,
    required this.hover,
    required this.track,
    required this.thumb,
    required this.text,
    required this.textMuted,
    required this.textSoft,
    required this.accent,
    required this.accentDark,
    required this.bandSurface,
    required this.bandForeground,
    required this.mention,
    required this.alertAction,
    required this.seatYou,
    required this.premiumChipFill,
    required this.premiumChipBorder,
    required this.premiumChipText,
    required this.premiumDot,
    required this.border,
    required this.btnPrimary,
    required this.btnPrimarySoft,
    required this.onBrand,
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
    required this.onDanger,
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
  final Color surface, elev, sheet, sheetPeek, sheetPeekInk;
  final Color hover, track, track50, thumb;
  final Color text, textMuted, textSoft, accent, accentDark;
  final Color bandSurface, bandForeground, bandForeground70, mention, seatYou;
  final Color alertAction;
  final Color premiumChipFill, premiumChipBorder, premiumChipText, premiumDot;
  final Color border, borderSoft, borderHalf, borderFaint, borderBiscotti40;
  final Color border70, border15;
  final Color elevTranslucent, surface80, surface0, surface35, surface85;
  final Color cardWhite55, cardWhite40, cardWhite30;
  final Color accent05, accent07, accent10, accent15, accent20, accent30;
  final Color accent35, accent40, accent50, accent60;
  final Color accentSelectedFill, accentSelectedBorder, borderAccent40;
  final Color timelineDotFill;
  final Color btnPrimary, btnPrimarySoft, onBrand, btn, btnHover;
  final Color btnBorderGhost;
  final Color stone, stone50, stone70, text40, text30, text25;
  final Color textMuted50, textMuted60, textMuted70, textMuted80;
  final Color placeholderMuted40, hover40, hover50;
  final Color pressWash, scrim, pressWashOnInk, pressWashOnGold;
  final Color dangerHover, danger70, danger30, danger10, danger06, cheatMark;
  final Color macroProtein, macroCarbs, macroFat;
  final Color chartProtein, chartCarbs, chartFat, chartMuted;
  final Color success, successAccent, successDark, successFaint;
  final Color successBorder, danger, onDanger, offTarget, offTarget70;
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
  static final KalloPalette light = _light;

  /// "Dark" in the UI — the Graphite design.
  static final KalloPalette dark = _dark;

  /// Aurora — Dark's plum-tinted sibling.
  static final KalloPalette aurora = _aurora;
}
