import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/auth/session_provider.dart';
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

/// The composer's controller — text AND the relog mention picks living inside
/// it as tinted runs. [FeedArea] reads it and must never dispose it; disposal
/// belongs to the container.
final composerControllerProvider = Provider<MentionTextEditingController>((
  ref,
) {
  ref.watch(loggingUiOwnerProvider);
  final controller = MentionTextEditingController();
  ref.onDispose(controller.dispose);
  return controller;
});

/// Ids of persisted meal cards the user has opened. A card checks in on mount
/// and reports every toggle, so re-entering Log (or scrolling a card back
/// into a recycling list) restores it open.
final expandedMealCardsProvider = StateProvider<Set<String>>((ref) {
  ref.watch(loggingUiOwnerProvider);
  return const <String>{};
});
