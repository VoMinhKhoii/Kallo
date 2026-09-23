import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/widgets/invite/invite_card.dart';
import 'package:kallo_mobile/models/social/circle.dart';

import '../../app_fonts.dart';
import '../../l10n_test_loader.dart';
import 'circle_feed_test_support.dart';

/// Both responses to an offer ask first. Backing out of the confirm must leave
/// the offer untouched — no request, card still actionable — and only the
/// affirmative reaches the server.

const _invite = MealShareInvite(
  id: 'invite-1',
  mode: 'copy',
  portionFactor: 1,
  from: CircleProfile(userId: 'u1', handle: 'mai', displayName: 'Mai'),
  rawInput: 'Bún chả',
  caloriesKcal: 600,
  proteinG: 30,
  carbohydrateG: 70,
  fatG: 20,
);

Future<FakeApiClient> _pumpCard(WidgetTester tester) async {
  final api = FakeApiClient((_) async => <String, dynamic>{});
  await pumpCircleScreen(
    tester,
    const Scaffold(
      body: SingleChildScrollView(
        child: SizedBox(width: 390, child: InviteCard(invite: _invite)),
      ),
    ),
    api: api,
  );
  return api;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpL10nBinding();
  setUpAll(loadAppFonts);

  testWidgets('dismiss asks first, and backing out sends nothing', (
    tester,
  ) async {
    final api = await _pumpCard(tester);

    await tester.tap(find.text('Dismiss'));
    await tester.pumpAndSettle();

    expect(find.text('Dismiss this meal?'), findsOneWidget);
    await tester.tap(find.text('Not now'));
    await tester.pumpAndSettle();

    expect(find.text('Dismiss this meal?'), findsNothing);
    expect(api.requests, isEmpty);
  });

  testWidgets('confirming the dismiss posts it', (tester) async {
    final api = await _pumpCard(tester);

    await tester.tap(find.text('Dismiss'));
    await tester.pumpAndSettle();
    // The card's own button is still under the barrier; the dialog's action is
    // the last "Dismiss" painted.
    await tester.tap(find.text('Dismiss').last);
    // Not pumpAndSettle: the card goes busy and its spinner never settles
    // against a fake that leaves the offer on screen.
    await tester.pump(const Duration(milliseconds: 500));

    expect(api.requests.single.path, '/api/v1/groups/invites/dismiss');
    expect(api.requests.single.body, {'inviteId': 'invite-1'});
  });

  testWidgets('accept asks first, and backing out sends nothing', (
    tester,
  ) async {
    final api = await _pumpCard(tester);

    await tester.tap(find.text('Accept'));
    await tester.pumpAndSettle();

    expect(find.text('Add this meal to your diary?'), findsOneWidget);
    await tester.tap(find.text('Not now'));
    await tester.pumpAndSettle();

    expect(api.requests, isEmpty);
  });
}
