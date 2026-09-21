import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/widgets/invite/deck/invite_deck.dart';
import 'package:kallo_mobile/features/circle/widgets/invite/invite_card.dart';
import 'package:kallo_mobile/models/social/circle.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import '../../app_fonts.dart';
import '../../l10n_test_loader.dart';
import 'circle_feed_test_support.dart';

/// The deck's whole job is that N offers occupy the height of ONE. There is no
/// cap on how many meals a friend can send, so what has to hold at any count:
/// one card is mounted, the peek stops at two, and the deck's height is the
/// card's plus a fixed reach rather than N cards tall.

MealShareInvite _invite(String id, String rawInput) => MealShareInvite(
  id: id,
  mode: 'copy',
  portionFactor: 1,
  from: const CircleProfile(userId: 'u1', handle: 'mai', displayName: 'Mai'),
  rawInput: rawInput,
  caloriesKcal: 600,
  proteinG: 30,
  carbohydrateG: 70,
  fatG: 20,
);

List<MealShareInvite> _deck(int n) =>
    List.generate(n, (i) => _invite('invite-$i', 'Meal $i'));

Future<void> _pumpDeck(WidgetTester tester, int count) async {
  await tester.pumpWidget(
    EasyLocalization(
      supportedLocales: const [Locale('en')],
      path: 'assets/l10n',
      fallbackLocale: const Locale('en'),
      assetLoader: const FsL10nLoader(),
      child: ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(
            FakeApiClient((_) async => <String, dynamic>{}),
          ),
        ],
        child: Builder(
          builder:
              (context) => MaterialApp(
                localizationsDelegates: context.localizationDelegates,
                supportedLocales: context.supportedLocales,
                locale: context.locale,
                home: Scaffold(
                  // A scroll view, not a bare Scaffold body: the inbox sits
                  // inside the circle screen's scroller, so it is laid out with
                  // an UNBOUNDED height. Under the body's bounded constraints
                  // the card's Column takes the whole viewport instead, and the
                  // height assertion below would read 600 back for any count.
                  body: SingleChildScrollView(
                    child: SizedBox(
                      width: 390,
                      child: InviteDeck(invites: _deck(count)),
                    ),
                  ),
                ),
              ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpL10nBinding();
  // The card measures text. Without the real face every glyph advances ~1em,
  // which overflows the macro row by 44pt and invents a layout bug that does
  // not exist on device — see `loadAppFonts`.
  setUpAll(loadAppFonts);

  testWidgets('draws no layers for a single offer', (tester) async {
    await _pumpDeck(tester, 1);

    // A lone card with a shadow behind it would promise a second offer that
    // acting on this one does not produce.
    expect(find.byType(InvitePeekLayer), findsNothing);
    expect(find.text('Meal 0'), findsOneWidget);
  });

  testWidgets('mounts only the front offer, whatever is behind it', (
    tester,
  ) async {
    await _pumpDeck(tester, 4);

    expect(find.byType(InviteCard), findsOneWidget);
    expect(find.text('Meal 0'), findsOneWidget);
    expect(find.text('Meal 1'), findsNothing);
    expect(find.text('Meal 3'), findsNothing);
  });

  testWidgets('caps the peek at two layers', (tester) async {
    // Ten pending offers must look the same as three. Past two the layers stop
    // reading as depth and start reading as a fringe on the card.
    await _pumpDeck(tester, 10);

    expect(find.byType(InvitePeekLayer), findsNWidgets(2));
  });

  testWidgets('grows the peek one layer at a time up to the cap', (
    tester,
  ) async {
    await _pumpDeck(tester, 2);
    expect(find.byType(InvitePeekLayer), findsOneWidget);

    await _pumpDeck(tester, 3);
    expect(find.byType(InvitePeekLayer), findsNWidgets(2));
  });

  testWidgets('stays one card tall plus the peek, at any count', (
    tester,
  ) async {
    await _pumpDeck(tester, 1);
    final one = tester.getSize(find.byType(InviteDeck)).height;

    await _pumpDeck(tester, 12);
    final many = tester.getSize(find.byType(InviteDeck)).height;

    // The whole point: twelve offers cost 12pt of peek, not eleven more cards.
    expect(many, one + 12);
  });

  testWidgets('keeps the layers out of the semantics tree', (tester) async {
    await _pumpDeck(tester, 3);

    // Every layer is an ExcludeSemantics at its root. A layer that leaked into
    // the tree would put a focus stop on a meal the user cannot see.
    expect(
      find.descendant(
        of: find.byType(InvitePeekLayer),
        matching: find.byType(ExcludeSemantics),
      ),
      findsNWidgets(2),
    );
  });
}
