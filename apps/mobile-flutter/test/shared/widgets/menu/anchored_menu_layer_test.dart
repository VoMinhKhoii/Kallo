import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/menu/anchored_menu_layer.dart';
import 'package:kallo_mobile/shared/widgets/menu/kallo_menu_card.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// The menu's geometry, pumped WITHOUT the route: everything the layer decides
/// — which side of the anchor the card takes, and the two edges it refuses to
/// cross — falls out of numbers handed to its constructor plus the ambient
/// insets, so a plain `pumpWidget` says more here than a dialog would.
/// `kallo_anchored_menu_test.dart` covers the route the layer opens under.

List<KalloMenuActionRow> _rows() => [
  KalloMenuActionRow(label: 'Copy', icon: LucideIcons.copy300, onTap: () {}),
  KalloMenuActionRow(label: 'Edit', icon: LucideIcons.pencil300, onTap: () {}),
];

/// The layer at [overlaySize], under [media]. It is pumped at the root, so the
/// window has to BE [overlaySize] for the card's global rect to read as the
/// layer's own coordinates — the same space the route measures its anchor in.
Widget _layer({
  required Rect anchor,
  required Size overlaySize,
  required MediaQueryData media,
  String? header,
  KalloMenuEdge edge = KalloMenuEdge.trailing,
}) => MaterialApp(
  home: MediaQuery(
    data: media,
    child: AnchoredMenuLayer(
      anchor: anchor,
      overlaySize: overlaySize,
      animation: const AlwaysStoppedAnimation<double>(1),
      edge: edge,
      header: header,
      rows: _rows(),
    ),
  ),
);

/// Puts the window on a 390x844 phone, so the layer laid out at that size fills
/// it exactly.
void _usePhone(WidgetTester tester) {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

const _phone = Size(390, 844);

void main() {
  testWidgets('hangs under the anchor, right edges flush', (tester) async {
    _usePhone(tester);
    const anchor = Rect.fromLTWH(100, 100, 240, 40);
    await tester.pumpWidget(
      _layer(
        anchor: anchor,
        overlaySize: _phone,
        media: const MediaQueryData(size: _phone),
      ),
    );
    await tester.pumpAndSettle();

    final card = tester.getRect(find.byType(KalloMenuCard));
    expect(card.top, closeTo(anchor.bottom + KalloSpacing.sp2, 0.5));
    expect(card.right, closeTo(anchor.right, 0.5));
    expect(card.width, closeTo(kKalloMenuWidth, 0.5));
    // Two 44pt rows and the hairline between them — the height the menu
    // computed BEFORE layout in order to decide it had room below.
    expect(
      card.height,
      closeTo(kalloMenuCardHeight(rows: 2, header: false), 0.5),
    );
  });

  testWidgets('flips above the anchor when it would run off the bottom', (
    tester,
  ) async {
    _usePhone(tester);
    // A card hung under this one would end at ~880, past the 844 floor.
    const anchor = Rect.fromLTWH(100, 743, 240, 40);
    await tester.pumpWidget(
      _layer(
        anchor: anchor,
        overlaySize: _phone,
        media: const MediaQueryData(size: _phone),
      ),
    );
    await tester.pumpAndSettle();

    final card = tester.getRect(find.byType(KalloMenuCard));
    expect(card.bottom, closeTo(anchor.top - KalloSpacing.sp2, 0.5));
    // Same edge, same gap — only the direction changed.
    expect(card.right, closeTo(anchor.right, 0.5));
  });

  testWidgets('flips above the anchor when the keyboard leaves no room below', (
    tester,
  ) async {
    _usePhone(tester);
    // The last sent bubble on the logging screen with the composer focused:
    // the keyboard eats 340 of the 844, and `padding.bottom` nets to 0 while
    // it is up. Room below the bubble is composer + keyboard — none of it
    // usable, so the card belongs above.
    const anchor = Rect.fromLTWH(100, 404, 240, 40); // bottom at 844-340-60
    await tester.pumpWidget(
      _layer(
        anchor: anchor,
        overlaySize: _phone,
        header: '1:04 AM',
        media: const MediaQueryData(
          size: _phone,
          viewInsets: EdgeInsets.only(bottom: 340),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final card = tester.getRect(find.byType(KalloMenuCard));
    expect(card.bottom, lessThanOrEqualTo(anchor.top - KalloSpacing.sp2 + 0.5));
    expect(card.right, closeTo(anchor.right, 0.5));
  });

  testWidgets('the card never leaves the top of the screen', (tester) async {
    _usePhone(tester);
    // A bubble taller than the screen minus the card: it flips, and an
    // unclamped flip puts the header and the first row above y=0.
    const anchor = Rect.fromLTWH(60, 20, 260, 780); // 20 -> 800
    const media = MediaQueryData(
      size: _phone,
      padding: EdgeInsets.only(top: 47, bottom: 34),
    );
    await tester.pumpWidget(
      _layer(anchor: anchor, overlaySize: _phone, media: media),
    );
    await tester.pumpAndSettle();

    final card = tester.getRect(find.byType(KalloMenuCard));
    expect(
      card.top,
      greaterThanOrEqualTo(media.padding.top + KalloSpacing.sp3 - 0.5),
    );
    expect(
      card.bottom,
      lessThanOrEqualTo(_phone.height - media.padding.bottom + 0.5),
    );
  });

  testWidgets('the leading edge shares the anchor left edge', (tester) async {
    _usePhone(tester);
    const anchor = Rect.fromLTWH(40, 100, 60, 40);
    await tester.pumpWidget(
      _layer(
        anchor: anchor,
        overlaySize: _phone,
        media: const MediaQueryData(size: _phone),
        edge: KalloMenuEdge.leading,
      ),
    );
    await tester.pumpAndSettle();

    expect(
      tester.getRect(find.byType(KalloMenuCard)).left,
      closeTo(anchor.left, 0.5),
    );
  });
}
