/// Riverpod state for the manual (Cronometer-style) logging sheet:
/// deterministic ingredient search + a picked-items list saved straight to
/// `POST /api/v1/meals/manual` — no AI pipeline, no pending analysis.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../data/api_client.dart';
import '../../../models/ingredient.dart';
import 'logging_keys.dart';
import 'logging_providers.dart';

const _uuid = Uuid();

/// Deterministic ingredient search. An empty query returns the user's recent
/// foods (instant suggestions before typing). Results are cached per query
/// string for a short while so backspacing through a word doesn't refetch.
final ingredientSearchProvider = FutureProvider.autoDispose.family<
  List<IngredientSearchResult>,
  String
>((ref, query) async {
  // Mirror the meal-dates staleTime trick: keep entries alive briefly so
  // retyping a just-seen query (and the recents list) resolves instantly.
  final link = ref.keepAlive();
  Timer? timer;
  ref.onDispose(() => timer?.cancel());
  ref.onCancel(() {
    timer = Timer(const Duration(minutes: 5), link.close);
  });
  ref.onResume(() => timer?.cancel());

  final api = ref.watch(apiClientProvider);
  final q = query.trim();
  final path =
      q.isEmpty
          ? '/api/v1/ingredients/search?limit=10'
          : '/api/v1/ingredients/search?q=${Uri.encodeQueryComponent(q)}&limit=10';
  final json = await api.get<Map<String, dynamic>>(path);
  final results =
      (json['results'] as List<dynamic>? ?? const [])
          .cast<Map<String, dynamic>>()
          .map(IngredientSearchResult.fromJson)
          .toList();
  return results;
});

class ManualLogState {
  final List<ManualLogItem> items;
  final bool isSaving;

  const ManualLogState({this.items = const [], this.isSaving = false});

  ManualLogState copyWith({List<ManualLogItem>? items, bool? isSaving}) =>
      ManualLogState(
        items: items ?? this.items,
        isSaving: isSaving ?? this.isSaving,
      );

  List<ManualLogItem> get completeItems =>
      items.where((i) => i.isComplete).toList();

  bool get canSave => !isSaving && completeItems.isNotEmpty;

  IngredientMacrosPer100g get totals => totalsForManualItems(items);
}

/// The picked-items list + save flow for one manual-log sheet session.
class ManualLogController extends AutoDisposeNotifier<ManualLogState> {
  @override
  ManualLogState build() => const ManualLogState();

  /// Add a picked search result with a sensible default portion the user can
  /// immediately edit inline (one tap to add keeps the flow fast).
  void addIngredient(IngredientSearchResult ingredient) {
    if (state.items.length >= 30) return;
    state = state.copyWith(
      items: [
        ...state.items,
        ManualLogItem(id: _uuid.v4(), ingredient: ingredient, grams: 100),
      ],
    );
  }

  void updateGrams(String itemId, double? grams) {
    final clamped = grams?.clamp(0, 5000).toDouble();
    state = state.copyWith(
      items: [
        for (final item in state.items)
          if (item.id == itemId) item.copyWith(grams: () => clamped) else item,
      ],
    );
  }

  void removeItem(String itemId) {
    state = state.copyWith(
      items: state.items.where((i) => i.id != itemId).toList(),
    );
  }

  /// Save the complete items as one meal, then run the same cache cascade the
  /// confirm flow uses (day feed, timeline dots, dashboard bundle). On
  /// failure the server changed nothing, so no surface is invalidated.
  Future<void> save({required String userId, required String date}) async {
    final items = state.completeItems;
    if (items.isEmpty || state.isSaving) return;

    final api = ref.read(apiClientProvider);
    state = state.copyWith(isSaving: true);
    try {
      await api.post<Map<String, dynamic>>('/api/v1/meals/manual', {
        'mealId': _uuid.v4(),
        'items': [
          for (final item in items)
            {'foodCompositionId': item.ingredient.id, 'grams': item.grams},
        ],
        'loggedDate': date,
        'timezoneOffset': timezoneOffsetMinutes(),
      });
      state = const ManualLogState();
      invalidateMealSurfaces(ref, userId, date);
    } finally {
      if (state.isSaving) state = state.copyWith(isSaving: false);
    }
  }
}

final manualLogProvider =
    AutoDisposeNotifierProvider<ManualLogController, ManualLogState>(
      ManualLogController.new,
    );
