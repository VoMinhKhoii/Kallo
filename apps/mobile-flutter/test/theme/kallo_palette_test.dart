import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';
import 'package:kallo_mobile/theme/kallo_palette.dart';

/// WCAG contrast ratio between two opaque colours.
double _contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  final hi = la > lb ? la : lb;
  final lo = la > lb ? lb : la;
  return (hi + 0.05) / (lo + 0.05);
}

void main() {
  tearDown(() => KalloPalette.apply(KalloPaletteId.light));

  test('light is the palette the app shipped before palettes, value for '
      'value', () {
    KalloPalette.apply(KalloPaletteId.light);
    // Every token as `KalloColors` declared it as a `const` before the
    // palette existed — the guard that light renders exactly as it did.
    final pinned = <String, (Color, Color)>{
      'surface': (KalloColors.surface, const Color(0xFFF8F7F4)),
      'elev': (KalloColors.elev, const Color(0xFFFFFFFF)),
      'hover': (KalloColors.hover, const Color(0xFFF0EAE0)),
      'track': (KalloColors.track, const Color(0xFFEDECE7)),
      'track50': (KalloColors.track50, const Color(0x80EDECE7)),
      'text': (KalloColors.text, const Color(0xFF141413)),
      'textMuted': (KalloColors.textMuted, const Color(0xFF7A7870)),
      'textSoft': (KalloColors.textSoft, const Color(0xFF3D3D3A)),
      'accent': (KalloColors.accent, const Color(0xFFC9A87C)),
      'accentDark': (KalloColors.accentDark, const Color(0xFFB89968)),
      'bandSurface': (KalloColors.bandSurface, const Color(0xFF6E6D66)),
      'bandForeground': (KalloColors.bandForeground, const Color(0xFFFFFFFF)),
      'bandForeground70': (
        KalloColors.bandForeground70,
        const Color(0xB3FFFFFF),
      ),
      'mention': (KalloColors.mention, const Color(0xFF2B72C6)),
      'premiumChipFill': (KalloColors.premiumChipFill, const Color(0xFFF5F8FE)),
      'premiumChipBorder': (
        KalloColors.premiumChipBorder,
        const Color(0xFFA9C1F0),
      ),
      'premiumChipText': (KalloColors.premiumChipText, const Color(0xFF2F5FD0)),
      'premiumDot': (KalloColors.premiumDot, const Color(0xFF3B6FE0)),
      'border': (KalloColors.border, const Color(0xFFE2DFD4)),
      'borderSoft': (KalloColors.borderSoft, const Color(0x99E2DFD4)),
      'borderHalf': (KalloColors.borderHalf, const Color(0x80E2DFD4)),
      'borderFaint': (KalloColors.borderFaint, const Color(0x4DE2DFD4)),
      'borderBiscotti40': (
        KalloColors.borderBiscotti40,
        const Color(0x66E2DFD4),
      ),
      'border70': (KalloColors.border70, const Color(0xB3E2DFD4)),
      'border15': (KalloColors.border15, const Color(0x26E2DFD4)),
      'elevTranslucent': (KalloColors.elevTranslucent, const Color(0xCCFFFFFF)),
      'surface80': (KalloColors.surface80, const Color(0xCCF8F7F4)),
      'surface0': (KalloColors.surface0, const Color(0x00F8F7F4)),
      'surface35': (KalloColors.surface35, const Color(0x59F8F7F4)),
      'surface85': (KalloColors.surface85, const Color(0xD9F8F7F4)),
      'cardWhite55': (KalloColors.cardWhite55, const Color(0x8CFFFFFF)),
      'cardWhite40': (KalloColors.cardWhite40, const Color(0x66FFFFFF)),
      'cardWhite30': (KalloColors.cardWhite30, const Color(0x4DFFFFFF)),
      'accent05': (KalloColors.accent05, const Color(0x0DC9A87C)),
      'accent07': (KalloColors.accent07, const Color(0x12C9A87C)),
      'accent10': (KalloColors.accent10, const Color(0x1AC9A87C)),
      'accent15': (KalloColors.accent15, const Color(0x26C9A87C)),
      'accent20': (KalloColors.accent20, const Color(0x33C9A87C)),
      'accent30': (KalloColors.accent30, const Color(0x4DC9A87C)),
      'accent35': (KalloColors.accent35, const Color(0x59C9A87C)),
      'accent40': (KalloColors.accent40, const Color(0x66C9A87C)),
      'accent50': (KalloColors.accent50, const Color(0x80C9A87C)),
      'accent60': (KalloColors.accent60, const Color(0x99C9A87C)),
      'accentSelectedFill': (
        KalloColors.accentSelectedFill,
        const Color(0x1AC9A87C),
      ),
      'accentSelectedBorder': (
        KalloColors.accentSelectedBorder,
        const Color(0x80C9A87C),
      ),
      'borderAccent40': (KalloColors.borderAccent40, const Color(0x66C9A87C)),
      'timelineDotFill': (KalloColors.timelineDotFill, const Color(0x4DC9A87C)),
      'btnPrimary': (KalloColors.btnPrimary, const Color(0xFF141413)),
      'btnPrimarySoft': (KalloColors.btnPrimarySoft, const Color(0xFFF0EAE0)),
      'btn': (KalloColors.btn, const Color(0xFF695E4E)),
      'btnHover': (KalloColors.btnHover, const Color(0xFF5A5043)),
      'btnBorderGhost': (KalloColors.btnBorderGhost, const Color(0x66695E4E)),
      'stone': (KalloColors.stone, const Color(0xFFA8A29E)),
      'stone50': (KalloColors.stone50, const Color(0x80A8A29E)),
      'stone70': (KalloColors.stone70, const Color(0xB3A8A29E)),
      'text40': (KalloColors.text40, const Color(0x66141413)),
      'text30': (KalloColors.text30, const Color(0x4D141413)),
      'text25': (KalloColors.text25, const Color(0x40141413)),
      'textMuted50': (KalloColors.textMuted50, const Color(0x807A7870)),
      'textMuted60': (KalloColors.textMuted60, const Color(0x997A7870)),
      'textMuted70': (KalloColors.textMuted70, const Color(0xB37A7870)),
      'textMuted80': (KalloColors.textMuted80, const Color(0xCC7A7870)),
      'placeholderMuted40': (
        KalloColors.placeholderMuted40,
        const Color(0x667A7870),
      ),
      'hover40': (KalloColors.hover40, const Color(0x66F0EAE0)),
      'hover50': (KalloColors.hover50, const Color(0x80F0EAE0)),
      'pressWash': (KalloColors.pressWash, const Color(0x0F141413)),
      'scrim': (KalloColors.scrim, const Color(0x80000000)),
      'pressWashOnInk': (KalloColors.pressWashOnInk, const Color(0x1FFFFFFF)),
      'pressWashOnGold': (KalloColors.pressWashOnGold, const Color(0x1F141413)),
      'dangerHover': (KalloColors.dangerHover, const Color(0xFFB81717)),
      'danger70': (KalloColors.danger70, const Color(0xB3D11A1A)),
      'danger30': (KalloColors.danger30, const Color(0x4DD11A1A)),
      'danger10': (KalloColors.danger10, const Color(0x1AD11A1A)),
      'danger06': (KalloColors.danger06, const Color(0x0FD11A1A)),
      'cheatMark': (KalloColors.cheatMark, const Color(0xFF8B7355)),
      'macroProtein': (KalloColors.macroProtein, const Color(0xFFD46A86)),
      'macroCarbs': (KalloColors.macroCarbs, const Color(0xFFE09C84)),
      'macroFat': (KalloColors.macroFat, const Color(0xFFE8C55C)),
      'chartProtein': (KalloColors.chartProtein, const Color(0xFFD46A86)),
      'chartCarbs': (KalloColors.chartCarbs, const Color(0xFFE09C84)),
      'chartFat': (KalloColors.chartFat, const Color(0xFFE8C55C)),
      'chartMuted': (KalloColors.chartMuted, const Color(0xFFCFCCC4)),
      'success': (KalloColors.success, const Color(0xFF7CA368)),
      'successAccent': (KalloColors.successAccent, const Color(0xFF1FA971)),
      'successDark': (KalloColors.successDark, const Color(0xFF14855A)),
      'successFaint': (KalloColors.successFaint, const Color(0xFFEAF7F0)),
      'successBorder': (KalloColors.successBorder, const Color(0x331FA971)),
      'danger': (KalloColors.danger, const Color(0xFFD11A1A)),
      'offTarget': (KalloColors.offTarget, const Color(0xFFD37B69)),
      'offTarget70': (KalloColors.offTarget70, const Color(0xB3D37B69)),
      'heatmapOnTarget': (KalloColors.heatmapOnTarget, const Color(0xFF7CA368)),
      'heatmapClose': (KalloColors.heatmapClose, const Color(0xFFA6C495)),
      'heatmapSlight': (KalloColors.heatmapSlight, const Color(0xFFD4C9AD)),
      'heatmapModerate': (KalloColors.heatmapModerate, const Color(0xFFE09C84)),
      'heatmapFar': (KalloColors.heatmapFar, const Color(0xFFD37B69)),
      'heatmapBarMiss': (KalloColors.heatmapBarMiss, const Color(0xFFD4C9AD)),
      'inputBorder': (KalloColors.inputBorder, const Color(0xFFE2DFD4)),
      'inputBorder40': (KalloColors.inputBorder40, const Color(0x66E2DFD4)),
      'textWarm': (KalloColors.textWarm, const Color(0xFF7B6F62)),
      'textHelp': (KalloColors.textHelp, const Color(0xFF8B8682)),
      'textSelected': (KalloColors.textSelected, const Color(0xFF6F6556)),
      'cream': (KalloColors.cream, const Color(0xFFFDFCF8)),
      'cream95': (KalloColors.cream95, const Color(0xF2FDFCF8)),
      'cardCream': (KalloColors.cardCream, const Color(0xFFFFFCF8)),
      'selectedCard': (KalloColors.selectedCard, const Color(0xFFFFF8EF)),
      'selectedSegment': (KalloColors.selectedSegment, const Color(0xFFFBF2E6)),
      'btnDarkHover': (KalloColors.btnDarkHover, const Color(0xFF1C1917)),
      'btnDarkHover2': (KalloColors.btnDarkHover2, const Color(0xFF3D3425)),
    };
    expect(pinned, hasLength(108));
    for (final MapEntry(key: name, value: (actual, expected))
        in pinned.entries) {
      expect(actual, expected, reason: name);
    }
  });

  test('tokens added for Dark keep the literal they replaced in light', () {
    KalloPalette.apply(KalloPaletteId.light);
    expect(KalloColors.sheet, const Color(0xFFFFFFFF)); // was kCardSurface
    expect(KalloColors.thumb, const Color(0xFFFFFFFF)); // was kCardSurface
    expect(KalloColors.onBrand, const Color(0xFF141413)); // was text
    expect(KalloColors.onDanger, const Color(0xFFFFFFFF)); // was white
    expect(KalloColors.seatYou, const Color(0xFF141413)); // seat 0 ink
    expect(KalloColors.sheetPeek, const Color(0xFFD9D6CE));
    expect(KalloColors.sheetPeekInk, const Color(0xFF55534D));
  });

  test('KalloColors reads whichever palette is current', () {
    KalloPalette.apply(KalloPaletteId.dark);
    expect(KalloColors.surface, const Color(0xFF0F0F0E));
    expect(KalloPalette.currentId, KalloPaletteId.dark);
    KalloPalette.apply(KalloPaletteId.aurora);
    expect(KalloColors.surface, const Color(0xFF131114));
    // The brand hues are constants, the same in every palette.
    expect(KalloColors.brandApricot, const Color(0xFFFFD2B0));
  });

  for (final id in [KalloPaletteId.dark, KalloPaletteId.aurora]) {
    final p = KalloPalette.byId(id);

    test('${id.name}: alpha variants keep their own palette\'s hue', () {
      expect(p.isDark, isTrue);
      expect(p.accent10, p.accent.withAlpha(0x1A));
      expect(p.borderSoft, p.border.withAlpha(0x99));
      expect(p.surface0, p.surface.withAlpha(0x00));
      expect(p.surface85, p.surface.withAlpha(0xD9));
      expect(p.cardWhite55, p.elev.withAlpha(0x8C));
      expect(p.textMuted70, p.textMuted.withAlpha(0xB3));
      expect(p.danger10, p.danger.withAlpha(0x1A));
      expect(p.chartProtein, p.macroProtein);
    });

    test(
      '${id.name}: text tokens clear WCAG AA on the canvas and on cards',
      () {
        final text = {
          'text': p.text,
          'textMuted': p.textMuted,
          'textSoft': p.textSoft,
          'danger': p.danger,
          'mention': p.mention,
          'successAccent': p.successAccent,
          'offTarget': p.offTarget,
          'textWarm': p.textWarm,
          'textHelp': p.textHelp,
          'stone': p.stone,
          'btn': p.btn,
          'premiumChipText': p.premiumChipText,
        };
        for (final MapEntry(key: name, value: color) in text.entries) {
          for (final ground in [p.surface, p.elev]) {
            expect(
              _contrast(color, ground),
              greaterThanOrEqualTo(4.5),
              reason: '$name on $ground',
            );
          }
        }
      },
    );
  }
}
