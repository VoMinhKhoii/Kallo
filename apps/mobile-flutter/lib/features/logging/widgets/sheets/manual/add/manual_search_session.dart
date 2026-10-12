import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../../models/nutrition/ingredient.dart';

/// The search fetch for one query.
typedef ManualSearchResults = AsyncValue<List<IngredientSearchResult>>;

/// The add sheet's search, kept above its page swap so a trip to a food's page
/// and back keeps it: the field's text, the [query] it settles into 300 ms
/// after the last keystroke, and the last results that arrived — held on
/// screen while the next query loads, so typing a letter doesn't blank the
/// list. Notifies when the query settles.
class ManualSearchSession extends ChangeNotifier {
  ManualSearchSession() {
    field.addListener(_typed);
  }

  final TextEditingController field = TextEditingController();
  Timer? _debounce;
  String _query = '';
  ({String query, List<IngredientSearchResult> results})? _last;

  /// The query the results are fetched for.
  String get query => _query;

  void _typed() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      _query = field.text.trim();
      notifyListeners();
    });
  }

  /// What the list shows for [results] — the fetch for [query]: those, or,
  /// while they load, the last results that arrived under their own query.
  ({String query, ManualSearchResults results}) shown(
    ManualSearchResults results,
  ) {
    if (results.valueOrNull case final list?) {
      _last = (query: _query, results: list);
    }
    final held = results.isLoading ? _last : null;
    return held == null
        ? (query: _query, results: results)
        : (query: held.query, results: AsyncData(held.results));
  }

  @override
  void dispose() {
    _debounce?.cancel();
    field.dispose();
    super.dispose();
  }
}
