import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/logging/logic/feed/meal_actions.dart';

import '../../../l10n_test_loader.dart';
import '../../circle/circle_feed_test_support.dart';

// The reported bug: take a friend's cheat offer, discard the staged card, and
// go back to the Circle inside the 5-second undo window. `/logging` is a route
// pushed over the shell, so going back disposes the feed — and the DELETE used
// to be gated on the feed still being mounted, so it never went out. The card
// only vanished locally, the offer stayed spent on the server, and the
// friend's re-share was skipped because the surviving card still held it.

const _pending = PendingMealConfirmation(
  id: 'staged-1',
  rawInput: 'Buffet nướng',
  loggedAt: '2026-09-22T05:00:00.000Z',
);

/// Stands in for the feed: builds [FeedMealActions] from its own context, the
/// way `FeedArea` does, and hands it out so the test can act through it.
class _Feed extends ConsumerStatefulWidget {
  const _Feed({required this.onActions});

  final ValueChanged<FeedMealActions> onActions;

  @override
  ConsumerState<_Feed> createState() => _FeedState();
}

class _FeedState extends ConsumerState<_Feed> {
  @override
  Widget build(BuildContext context) {
    widget.onActions(
      FeedMealActions(
        context: context,
        ref: ref,
        userId: 'u1',
        date: '2026-09-22',
        onHoldRemoval: (_) {},
        onReleaseRemoval: (_) {},
        onRemovalFailed: (_) {},
      ),
    );
    return const SizedBox.shrink();
  }
}

Future<({FakeApiClient api, FeedMealActions actions, ValueNotifier<bool> open})>
_pump(WidgetTester tester) async {
  final api = FakeApiClient(
    (r) async =>
        r.path.startsWith('/api/v1/groups/invites')
            ? <String, dynamic>{'invites': <dynamic>[]}
            : <String, dynamic>{},
  );
  final open = ValueNotifier(true);
  late FeedMealActions actions;
  await pumpCircleScreen(
    tester,
    Scaffold(
      // The pill-nav badge: lives outside `/logging` and keeps the inbox
      // provider alive, so an invalidate means a refetch.
      bottomNavigationBar: Consumer(
        builder: (_, ref, __) {
          ref.watch(mealShareInvitesProvider);
          return const SizedBox.shrink();
        },
      ),
      body: ValueListenableBuilder<bool>(
        valueListenable: open,
        builder:
            (_, isOpen, __) =>
                isOpen
                    ? _Feed(onActions: (a) => actions = a)
                    : const SizedBox.shrink(),
      ),
    ),
    api: api,
  );
  return (api: api, actions: actions, open: open);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpL10nBinding();

  testWidgets('leaving the feed inside the undo window still discards', (
    tester,
  ) async {
    final h = await _pump(tester);

    int inboxFetches() =>
        h.api.requests
            .where((r) => r.path.startsWith('/api/v1/groups/invites'))
            .length;
    final before = inboxFetches();

    h.actions.discardPending(_pending);
    await tester.pump();
    // Back to the Circle, one second into the window.
    await tester.pump(const Duration(seconds: 1));
    h.open.value = false;
    await tester.pump();

    await tester.pump(const Duration(seconds: 6));
    await tester.pumpAndSettle();

    final deletes = h.api.requests.where((r) => r.method == 'DELETE');
    expect(deletes.map((r) => r.path), ['/api/v1/meals/pending/staged-1']);
    // And the inbox is asked again, so the handed-back offer shows up in the
    // Circle the user just went back to.
    expect(inboxFetches(), greaterThan(before));
  });

  testWidgets('undo still keeps the card', (tester) async {
    final h = await _pump(tester);

    h.actions.discardPending(_pending);
    await tester.pump();
    await tester.tap(find.text('Undo'));
    await tester.pump(const Duration(seconds: 6));
    await tester.pumpAndSettle();

    expect(h.api.requests.where((r) => r.method == 'DELETE'), isEmpty);
  });
}
