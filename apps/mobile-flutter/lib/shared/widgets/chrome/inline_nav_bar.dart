import 'package:flutter/cupertino.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';

/// iOS's inline navigation bar for a page one level down — a
/// [CupertinoNavigationBar]: "‹ " + the page it came from on the leading edge,
/// this page's own title centred at [kSectionHeader].
///
/// The large left-aligned 28pt `PageHeader` is the ROOT of a stack; a pushed
/// page wearing the same headline read as another top-level screen, so nothing
/// told the user they were one level deep. This is the bar that does.
///
/// The SDK bar does the layout — the title centred on the bar, nudged clear of
/// the back button only when it would run under it. What this adds is the
/// configuration every caller shares: the app's type and ink instead of SF
/// Pro and system blue (the `kallo_confirm.dart` override), no fill, blur or
/// border (the hairline under it belongs to `ScrollSeparator`, which draws it
/// once content has scrolled), and no status-bar inset — every caller already
/// sits below the safe area.
///
/// **One exception, the back button** (`kallo-design/mobile.md`, *Cupertino
/// wherever it exists*). `CupertinoNavigationBarBackButton` draws its chevron
/// from the `CupertinoIcons` font, which this app does not ship — there is no
/// `cupertino_icons` dependency, Lucide is the icon set — so it renders a
/// missing-glyph box (reproduced in the settings goldens, 2026-09-24). Its
/// chevron/label parts are private, so the leading slot is a [CupertinoButton]
/// with the Lucide chevron and the SDK's own label rule instead. Retire it if
/// the app ever bundles `cupertino_icons`.
///
/// Shared by the settings sub-pages and `KalloSheetSubHeader`, which adds the
/// grabber above it.
class InlineNavBar extends StatelessWidget {
  const InlineNavBar({
    super.key,
    required this.title,
    required this.parentTitle,
    this.onBack,
  });

  /// This page's title, centred.
  final String title;

  /// The title of the page this one was pushed from.
  final String parentTitle;

  /// Defaults to `maybePop` on the nearest navigator — inside settings that is
  /// the nested one, so back goes up one level instead of closing the screen.
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return CupertinoTheme(
      data: CupertinoThemeData(
        brightness: Brightness.light,
        primaryColor: KalloColors.textMuted,
        textTheme: CupertinoTextThemeData(navTitleTextStyle: kSectionHeader()),
      ),
      child: MediaQuery.removePadding(
        context: context,
        removeTop: true,
        child: CupertinoNavigationBar(
          // The chevron's own inset is set in [_backButton]; the bar's
          // default 16 would double it.
          padding: const EdgeInsetsDirectional.only(start: 0),
          leading: _backButton(context),
          middle: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
          // Whatever the bar sits on — the page or a sheet — shows through:
          // a transparent bar with the blur off, not a second surface.
          backgroundColor: const Color(0x00000000),
          enableBackgroundFilterBlur: false,
          // Keeps the status bar's glyphs dark on the cream page; a clear
          // background would otherwise read as "dark" and flip them white.
          brightness: Brightness.light,
          border: null,
          automaticallyImplyLeading: false,
          automaticallyImplyMiddle: false,
          // Every push here is a MaterialPageRoute from a root without a
          // nav bar, so there is no bar to fly the title from.
          transitionBetweenRoutes: false,
        ),
      ),
    );
  }

  /// Parent titles longer than this read "Back" — the SDK's own threshold
  /// (`_BackLabel` in `cupertino/nav_bar.dart`). Our parents are not all
  /// short nouns: the log-mode sheet's is the question "How do you want to
  /// log?", and ellipsising it would name nothing.
  static const int _maxParentLength = 12;

  Widget _backButton(BuildContext context) {
    final label =
        parentTitle.length > _maxParentLength
            ? CupertinoLocalizations.of(context).backButtonLabel
            : parentTitle;
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: CupertinoButton(
        padding: const EdgeInsetsDirectional.only(start: KalloSpacing.sp2),
        minimumSize: const Size(KalloIcons.hit, KalloIcons.hit),
        onPressed: onBack ?? () => Navigator.maybePop(context),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              LucideIcons.chevronLeft300,
              size: KalloIcons.size,
              color: KalloColors.textMuted,
            ),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: dashBody(color: KalloColors.textMuted),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
