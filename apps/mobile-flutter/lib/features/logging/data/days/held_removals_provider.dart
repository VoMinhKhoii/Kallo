import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Meals whose delete is waiting out its undo window.
///
/// The feed hides them and the gauges stop counting them the moment the
/// person deletes. The days pane reads the same set, so the row and the ring
/// beside the gauges drop the meal with them instead of five seconds later.
final heldMealRemovalsProvider = StateProvider<Set<String>>((ref) => const {});

/// Adds [id] to the held meals, or takes it out again.
void holdMealRemoval(ProviderContainer scope, String id, {required bool held}) {
  final set = scope.read(heldMealRemovalsProvider.notifier);
  if (held == set.state.contains(id)) return;
  set.state = held ? {...set.state, id} : set.state.difference({id});
}
