import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../models/nutrition/ingredient.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import 'manual_result_row.dart';

/// Search results, growing BOTTOM-UP toward the field (native pass,
/// 2026-08-31): the closest match sits adjacent to the search pill under the
/// thumb, and the list scrolls away upward. `reverse: true` does both jobs —
/// it lays the first result out last AND parks the scroll offset at the
/// closest match instead of at the weakest one.
class ManualResultsList extends StatelessWidget {
  const ManualResultsList({
    super.key,
    required this.query,
    required this.resultsAsync,
    required this.onPick,
  });

  final String query;
  final AsyncValue<List<IngredientSearchResult>> resultsAsync;
  final ValueChanged<IngredientSearchResult> onPick;

  bool get _isRecents => query.isEmpty;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          _isRecents
              ? 'logging.manualLogging.recentFoods'.tr()
              : 'logging.manualLogging.resultsFor'.tr(
                  namedArgs: {'query': query},
                ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: dashMeta(),
        ),
        const SizedBox(height: KalloSpacing.sp1),
        resultsAsync.when(
          loading: () => _Message(text: 'logging.manualLogging.searching'.tr()),
          error: (_, __) => _Message(
            text: 'errors.internal'.tr(),
            color: KalloColors.danger,
          ),
          data: _buildResults,
        ),
      ],
    );
  }

  /// A plain Column, not a ListView: the sheet owns ONE scroll view so the
  /// added card and the results move together, and a nested scrollable would
  /// also cost the sheet its swipe-to-dismiss.
  Widget _buildResults(List<IngredientSearchResult> results) {
    if (results.isEmpty) {
      // An empty recents list just means a new user — nudge them to search
      // rather than show an alarming "no results".
      return _Message(
        text: (_isRecents
                ? 'logging.manualLogging.recentsHint'
                : 'logging.manualLogging.noResults')
            .tr(),
      );
    }
    // Reversed: the closest match lands LAST, adjacent to the search pill.
    final ordered = results.reversed.toList();
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < ordered.length; i++) ...[
          if (i > 0)
            const ColoredBox(color: kHairline, child: SizedBox(height: 1)),
          ManualResultRow(
            key: ValueKey(ordered[i].id),
            result: ordered[i],
            onTap: () => onPick(ordered[i]),
          ),
        ],
      ],
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.text, this.color});

  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp4),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: color == null ? dashMeta() : dashMeta(color: color!),
      ),
    );
  }
}
