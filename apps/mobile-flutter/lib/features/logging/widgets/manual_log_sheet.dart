import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/ingredient.dart';
import '../../../shared/widgets/decimal_input.dart';
import '../../../shared/widgets/nham_text.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../data/manual_log_providers.dart';

/// Open the manual-log sheet: search the food database, enter exact grams,
/// save deterministically — no AI. The Cronometer-style mobile flow.
Future<void> showManualLogSheet(
  BuildContext context, {
  required String userId,
  required String date,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => ManualLogSheet(userId: userId, date: date),
  );
}

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

  Future<void> _save() async {
    setState(() => _errorText = null);
    try {
      await ref
          .read(manualLogProvider.notifier)
          .save(userId: widget.userId, date: widget.date);
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      if (mounted) {
        setState(() => _errorText = 'errors.internal'.tr());
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // The items state is watched only inside the selected-items and totals
    // Consumers below — a grams keystroke rebuilds those two sections, not
    // the whole sheet (search field, results, header).
    final resultsAsync = ref.watch(ingredientSearchProvider(_query));
    final maxHeight = MediaQuery.of(context).size.height * 0.9;
    final keyboardInset = MediaQuery.of(context).viewInsets.bottom;
    final bottomInset = MediaQuery.of(context).padding.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: keyboardInset),
      child: Container(
        constraints: BoxConstraints(maxHeight: maxHeight),
        decoration: const BoxDecoration(
          color: NhamColors.surface,
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(NhamRadii.xxl),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: NhamSpacing.sp2),
            // Drag handle.
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: NhamColors.borderSoft,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                NhamSpacing.sp4,
                NhamSpacing.sp3,
                NhamSpacing.sp2,
                NhamSpacing.sp2,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        NhamText(
                          'logging.manualLogging.title'.tr(),
                          variant: NhamTextVariant.h3,
                        ),
                        const SizedBox(height: 2),
                        NhamText(
                          'logging.manualLogging.subtitle'.tr(),
                          variant: NhamTextVariant.small,
                          style: const TextStyle(color: NhamColors.textMuted),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close, size: 20),
                    color: NhamColors.textMuted,
                    tooltip: 'common.cancel'.tr(),
                  ),
                ],
              ),
            ),

            // Search field.
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp4),
              child: TextField(
                controller: _searchController,
                autofocus: true,
                style: NhamTextStyles.sansRegular(
                  fontSize: NhamFontSize.sm,
                ).copyWith(color: NhamColors.text),
                cursorColor: NhamColors.accent,
                decoration: InputDecoration(
                  isDense: true,
                  prefixIcon: const Icon(
                    Icons.search,
                    size: 18,
                    color: NhamColors.textMuted,
                  ),
                  hintText: 'logging.manualLogging.searchPlaceholder'.tr(),
                  hintStyle: NhamTextStyles.sansRegular(
                    fontSize: NhamFontSize.sm,
                  ).copyWith(color: NhamColors.placeholderMuted40),
                  filled: true,
                  fillColor: NhamColors.elev,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: NhamSpacing.sp3,
                    vertical: NhamSpacing.sp2,
                  ),
                  border: _searchBorder(NhamColors.inputBorder),
                  enabledBorder: _searchBorder(NhamColors.inputBorder),
                  focusedBorder: _searchBorder(NhamColors.borderAccent40),
                ),
              ),
            ),

            // Picked items + search results.
            Flexible(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  NhamSpacing.sp4,
                  NhamSpacing.sp3,
                  NhamSpacing.sp4,
                  NhamSpacing.sp3,
                ),
                children: [
                  Consumer(
                    builder: (context, ref, _) {
                      final state = ref.watch(manualLogProvider);
                      if (state.items.isEmpty) return const SizedBox.shrink();
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          NhamText(
                            'logging.manualLogging.selected'.tr(),
                            variant: NhamTextVariant.eyebrow,
                          ),
                          const SizedBox(height: NhamSpacing.sp2),
                          for (final item in state.items)
                            _SelectedItemRow(
                              key: ValueKey(item.id),
                              item: item,
                              disabled: state.isSaving,
                              onGramsChange:
                                  (grams) => ref
                                      .read(manualLogProvider.notifier)
                                      .updateGrams(item.id, grams),
                              onRemove:
                                  () => ref
                                      .read(manualLogProvider.notifier)
                                      .removeItem(item.id),
                            ),
                          const SizedBox(height: NhamSpacing.sp3),
                        ],
                      );
                    },
                  ),
                  _ResultsSection(
                    query: _query,
                    resultsAsync: resultsAsync,
                    onPick: (ingredient) {
                      ref
                          .read(manualLogProvider.notifier)
                          .addIngredient(ingredient);
                    },
                  ),
                ],
              ),
            ),

            if (_errorText != null)
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: NhamSpacing.sp4,
                ),
                child: NhamText(
                  _errorText!,
                  variant: NhamTextVariant.small,
                  style: const TextStyle(color: NhamColors.danger),
                ),
              ),

            // Pinned totals + save bar.
            Container(
              padding: EdgeInsets.fromLTRB(
                NhamSpacing.sp4,
                NhamSpacing.sp3,
                NhamSpacing.sp4,
                (keyboardInset > 0 ? 0 : bottomInset) + NhamSpacing.sp3,
              ),
              decoration: const BoxDecoration(
                color: NhamColors.elev,
                border: Border(top: BorderSide(color: NhamColors.borderFaint)),
              ),
              child: Consumer(
                builder: (context, ref, _) {
                  final state = ref.watch(manualLogProvider);
                  return Row(
                    children: [
                      Expanded(child: _TotalsSummary(totals: state.totals)),
                      const SizedBox(width: NhamSpacing.sp3),
                      _SaveButton(
                        enabled: state.canSave,
                        saving: state.isSaving,
                        onTap: _save,
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  OutlineInputBorder _searchBorder(Color color) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(NhamRadii.lg),
    borderSide: BorderSide(color: color),
  );
}

/// "raw" / "cooked" pill — grams mean what the DB row's state says, so the
/// distinction must be effortless to see.
class _StateBadge extends StatelessWidget {
  const _StateBadge({required this.state});

  final String state;

  @override
  Widget build(BuildContext context) {
    final cooked = state == 'cooked';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: cooked ? NhamColors.accent15 : NhamColors.hover,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        (cooked
                ? 'logging.manualLogging.stateCooked'
                : 'logging.manualLogging.stateRaw')
            .tr(),
        style: NhamTextStyles.sansMedium(fontSize: 10).copyWith(
          color: cooked ? NhamColors.accentDark : NhamColors.textMuted,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}

class _SelectedItemRow extends StatelessWidget {
  const _SelectedItemRow({
    super.key,
    required this.item,
    required this.disabled,
    required this.onGramsChange,
    required this.onRemove,
  });

  final ManualLogItem item;
  final bool disabled;
  final ValueChanged<double?> onGramsChange;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final kcal = item.macros?.caloriesKcal;
    return Container(
      margin: const EdgeInsets.only(bottom: NhamSpacing.sp2),
      padding: const EdgeInsets.all(NhamSpacing.sp2),
      decoration: BoxDecoration(
        color: NhamColors.elev,
        borderRadius: BorderRadius.circular(NhamRadii.lg),
        border: Border.all(color: NhamColors.borderFaint),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: NhamText(
                        item.ingredient.namePrimary,
                        variant: NhamTextVariant.itemName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 6),
                    _StateBadge(state: item.ingredient.state),
                  ],
                ),
                const SizedBox(height: 2),
                NhamText(
                  kcal == null
                      ? '—'
                      : '${kcal.round()} ${'logging.manualLogging.kcal'.tr()}',
                  variant: NhamTextVariant.numCaption,
                  style: const TextStyle(color: NhamColors.textMuted),
                ),
              ],
            ),
          ),
          const SizedBox(width: NhamSpacing.sp2),
          SizedBox(
            width: 76,
            child: DecimalInput(
              value: item.grams,
              onValueChange: disabled ? (_) {} : onGramsChange,
              hintText: '100',
              textAlign: TextAlign.end,
            ),
          ),
          const SizedBox(width: 4),
          NhamText(
            'logging.manualLogging.gramsUnit'.tr(),
            variant: NhamTextVariant.small,
            style: const TextStyle(color: NhamColors.textMuted),
          ),
          IconButton(
            onPressed: disabled ? null : onRemove,
            icon: const Icon(Icons.close, size: 16),
            color: NhamColors.textMuted50,
            tooltip: 'logging.manualLogging.removeItem'.tr(),
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }
}

class _ResultsSection extends StatelessWidget {
  const _ResultsSection({
    required this.query,
    required this.resultsAsync,
    required this.onPick,
  });

  final String query;
  final AsyncValue<List<IngredientSearchResult>> resultsAsync;
  final ValueChanged<IngredientSearchResult> onPick;

  @override
  Widget build(BuildContext context) {
    final isRecents = query.isEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (isRecents)
          Padding(
            padding: const EdgeInsets.only(bottom: NhamSpacing.sp2),
            child: NhamText(
              'logging.manualLogging.recentFoods'.tr(),
              variant: NhamTextVariant.eyebrow,
            ),
          ),
        resultsAsync.when(
          loading:
              () => Padding(
                padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp4),
                child: Center(
                  child: NhamText(
                    'logging.manualLogging.searching'.tr(),
                    variant: NhamTextVariant.small,
                    style: const TextStyle(color: NhamColors.textMuted),
                  ),
                ),
              ),
          error:
              (_, __) => Padding(
                padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp4),
                child: NhamText(
                  'errors.internal'.tr(),
                  variant: NhamTextVariant.small,
                  style: const TextStyle(color: NhamColors.danger),
                ),
              ),
          data: (results) {
            if (results.isEmpty) {
              // An empty recents list just means a new user — show nothing
              // rather than an alarming "no results".
              if (isRecents) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp4),
                child: NhamText(
                  'logging.manualLogging.noResults'.tr(),
                  variant: NhamTextVariant.small,
                  style: const TextStyle(color: NhamColors.textMuted),
                ),
              );
            }
            return Column(
              children: [
                for (final result in results)
                  _ResultTile(result: result, onTap: () => onPick(result)),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _ResultTile extends StatelessWidget {
  const _ResultTile({required this.result, required this.onTap});

  final IngredientSearchResult result;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final kcal = result.per100g.caloriesKcal;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(NhamRadii.md),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp1,
            vertical: NhamSpacing.sp2,
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: NhamText(
                            result.namePrimary,
                            variant: NhamTextVariant.body,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 6),
                        _StateBadge(state: result.state),
                        if (result.semantic) ...[
                          const SizedBox(width: 6),
                          Text(
                            '≈ ${'logging.manualLogging.relatedMatch'.tr()}',
                            style: NhamTextStyles.sansRegular(
                              fontSize: 10,
                            ).copyWith(color: NhamColors.textMuted60),
                          ),
                        ],
                      ],
                    ),
                    if (result.nameEn != null && result.nameEn!.isNotEmpty)
                      NhamText(
                        result.nameEn!,
                        variant: NhamTextVariant.small,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: NhamColors.textMuted),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: NhamSpacing.sp2),
              NhamText(
                kcal == null
                    ? '—'
                    : '${kcal.round()} ${'logging.manualLogging.kcalPer100g'.tr()}',
                variant: NhamTextVariant.numCaption,
                style: const TextStyle(color: NhamColors.textMuted),
              ),
              const SizedBox(width: NhamSpacing.sp1),
              const Icon(
                Icons.add_circle_outline,
                size: 18,
                color: NhamColors.accentDark,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TotalsSummary extends StatelessWidget {
  const _TotalsSummary({required this.totals});

  final IngredientMacrosPer100g totals;

  String _fmt(double? value) => value == null ? '—' : '${value.round()}';

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        NhamText(
          '${_fmt(totals.caloriesKcal)} ${'logging.manualLogging.kcal'.tr()}',
          variant: NhamTextVariant.macroValue,
        ),
        const SizedBox(height: 2),
        NhamText(
          'P ${_fmt(totals.proteinG)} · C ${_fmt(totals.carbohydrateG)} · F ${_fmt(totals.fatG)}',
          variant: NhamTextVariant.numCaption,
          style: const TextStyle(color: NhamColors.textMuted),
        ),
      ],
    );
  }
}

class _SaveButton extends StatelessWidget {
  const _SaveButton({
    required this.enabled,
    required this.saving,
    required this.onTap,
  });

  final bool enabled;
  final bool saving;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: enabled,
      label: 'logging.manualLogging.save'.tr(),
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        child: Opacity(
          opacity: enabled ? 1 : 0.4,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: NhamSpacing.sp4,
              vertical: NhamSpacing.sp2,
            ),
            decoration: BoxDecoration(
              color: NhamColors.btn,
              borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
            ),
            child:
                saving
                    ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                    : Text(
                      'logging.manualLogging.save'.tr(),
                      style: NhamTextStyles.sansMedium(
                        fontSize: NhamFontSize.sm,
                      ).copyWith(color: Colors.white),
                    ),
          ),
        ),
      ),
    );
  }
}
