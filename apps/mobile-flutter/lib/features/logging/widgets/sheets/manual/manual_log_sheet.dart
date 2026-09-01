import 'dart:async';
import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../../theme/kallo_motion.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../data/manual_log_providers.dart';
import 'manual_added_block.dart';
import 'manual_results_list.dart';
import 'manual_search_field.dart';

/// Open the manual-log sheet: search the food database, enter exact grams,
/// save deterministically — no AI.
Future<void> showManualLogSheet(
  BuildContext context, {
  required String userId,
  required String date,
}) {
  return showNhamSheet<void>(
    context,
    isScrollControlled: true,
    builder: (context) => ManualLogSheet(userId: userId, date: date),
  );
}

/// Finger-first manual logging (native pass, 2026-08-31): what you have added
/// stacks DOWN from the top under its running total, Save sits directly under
/// that card, and the search field is pinned to the bottom with the results
/// growing up toward it. Everything the hand touches repeatedly lives in the
/// bottom third; only the summary — which is read, not tapped — is up top.
class ManualLogSheet extends ConsumerStatefulWidget {
  const ManualLogSheet({super.key, required this.userId, required this.date});

  final String userId;
  final String date;

  @override
  ConsumerState<ManualLogSheet> createState() => _ManualLogSheetState();
}

class _ManualLogSheetState extends ConsumerState<ManualLogSheet> {
  static const _debounce = Duration(milliseconds: 300);

  final TextEditingController _searchController = TextEditingController();

  /// The "Added" block, so an add can scroll its own confirmation into view.
  final GlobalKey _addedKey = GlobalKey();

  Timer? _debounceTimer;
  String _query = '';
  String? _errorText;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(_debounce, () {
      if (!mounted) return;
      setState(() => _query = _searchController.text.trim());
    });
  }

  /// Reveal the "Added" summary after an add.
  ///
  /// The body opens scrolled to the BOTTOM (`reverse: true`) so the closest
  /// match sits against the search pill — which means the summary and
  /// "Save · N kcal" insert ABOVE the current scroll position. On a full
  /// results list that put the only confirmation the tap had registered
  /// off-screen, and the row read as dead. Runs after the frame that inserts
  /// the block, since before it there is nothing to scroll to.
  void _revealAdded() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final target = _addedKey.currentContext;
      if (target == null) return;
      Scrollable.ensureVisible(
        target,
        duration: KalloMotion.quick,
        curve: Curves.easeOut,
        // Align its TOP to the viewport's: the summary leads, the rows and
        // Save follow beneath it.
        alignment: 0,
      );
    });
  }

  Future<void> _save() async {
    setState(() => _errorText = null);
    try {
      await ref
          .read(manualLogProvider.notifier)
          .save(userId: widget.userId, date: widget.date);
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      if (mounted) setState(() => _errorText = 'errors.internal'.tr());
    }
  }

  @override
  Widget build(BuildContext context) {
    // The items state is watched only inside the added-block Consumer below —
    // a grams keystroke rebuilds that section, not the search field or results.
    final resultsAsync = ref.watch(ingredientSearchProvider(_query));
    final media = MediaQuery.of(context);
    final keyboardInset = media.viewInsets.bottom;

    // The surface lifts itself clear of the keyboard; the cap it is given
    // has to come off the height the keyboard LEAVES, not the whole screen.
    return KalloSheetSurface(
      constraints: BoxConstraints(maxHeight: (media.size.height - keyboardInset) * 0.9),
      padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp4),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KalloSheetHeader(title: 'logging.manualLogging.sheetTitle'.tr()),
          // ONE scroll view for the whole body: added card at the top,
          // results at the bottom, and a Spacer between them that hands its
          // space back the moment the content needs it (landscape). It
          // opens scrolled to the BOTTOM (`reverse`), so the closest match
          // is the row already sitting against the search pill.
          Flexible(
            child: LayoutBuilder(
              builder: (context, constraints) => SingleChildScrollView(
                reverse: true,
                physics: const ClampingScrollPhysics(),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight: constraints.maxHeight,
                  ),
                  child: IntrinsicHeight(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        ManualAddedBlock(
                          key: _addedKey,
                          onSave: _save,
                          errorText: _errorText,
                        ),
                        const Spacer(),
                        const SizedBox(height: KalloSpacing.sp3),
                        ManualResultsList(
                          query: _query,
                          resultsAsync: resultsAsync,
                          onPick: (ingredient) {
                            ref
                                .read(manualLogProvider.notifier)
                                .addIngredient(ingredient);
                            _revealAdded();
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: KalloSpacing.sp2),
          ManualSearchField(controller: _searchController),
          // 34pt home inset at rest (floored for phones without one); the
          // pad's own inset covers it when the keyboard is up.
          SizedBox(
            height: keyboardInset > 0
                ? KalloSpacing.sp2
                : math.max(media.viewPadding.bottom, KalloSpacing.sp4),
          ),
        ],
      ),
    );
  }

}
