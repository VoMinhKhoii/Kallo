import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/auth/session_provider.dart';
import '../logic/relog/mentions.dart';
import '../widgets/relog/mention_text_controller.dart';

/// Ephemeral Log-screen UI state that must OUTLIVE the route.
///
/// When the shell held Log as an IndexedStack branch, the feed's widget State
/// survived tab switches for free. The native pass made Log a full-screen
/// push, so every visit builds a fresh subtree — and the composer draft and
/// each card's expansion died with the old one (the 2026-08-31 TestFlight
/// regression). These providers pin that state to the app-lifetime container
/// instead of the route.

/// Whose sticky Log state this is. Both providers below watch it, so a
/// sign-out or account switch rebuilds them — one user's half-typed draft
/// must never greet the next account on a shared device. (Day switches within
/// a session deliberately keep the draft: the composer always submits to the
/// day open at send time, matching the pre-native-pass behavior.)
final loggingUiOwnerProvider = Provider<String?>(
  (ref) => ref.watch(currentSessionProvider.select((s) => s?.user.id)),
);

/// The composer's DRAFT — the text and the relog picks inside it, as plain
/// data. [FeedArea] seeds its own controller from this on mount and writes it
/// back on every change.
///
/// Plain data, and not the controller itself: a [ChangeNotifier] parked in a
/// provider is disposed the instant the provider rebuilds, and the owner above
/// changing (an A→B account switch, with the Log screen still mounted) does
/// exactly that — under the live widgets holding it. The controller belongs to
/// the State that hands it to a TextField; only the draft outlives the route.
final composerDraftProvider = StateProvider<MentionSnapshot>((ref) {
  ref.watch(loggingUiOwnerProvider);
  return const MentionSnapshot(text: '', mentions: []);
});

/// The live composer controller for ONE visit to the Log screen, bound to the
/// draft above: seeded from it on mount, flushed back on every change, and
/// disposed with the State that owns it — never by a provider rebuild.
class ComposerDraftHost {
  ComposerDraftHost(this._ref) {
    controller = MentionTextEditingController()
      ..restore(_ref.read(composerDraftProvider))
      ..addListener(_flush);
  }

  final WidgetRef _ref;
  late final MentionTextEditingController controller;

  /// Every mutation of the composer notifies — a keystroke, a committed pick, a
  /// submit that clears it — so the draft is always current for the next visit.
  void _flush() =>
      _ref.read(composerDraftProvider.notifier).state = controller.snapshot();

  /// Call from `build`: a sign-out or account switch resets the draft, and the
  /// live field has to follow it. One user's half-typed meal must never greet
  /// the next on a shared device.
  void followOwner(WidgetRef ref) =>
      ref.listen(loggingUiOwnerProvider, (_, _) => controller.clear());

  void dispose() {
    controller.removeListener(_flush);
    controller.dispose();
  }
}

/// Ids of persisted meal cards the user has opened. A card checks in on mount
/// and reports every toggle, so re-entering Log (or scrolling a card back
/// into a recycling list) restores it open.
final expandedMealCardsProvider = StateProvider<Set<String>>((ref) {
  ref.watch(loggingUiOwnerProvider);
  return const <String>{};
});
