import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/ingredient.dart';
import '../../../../shared/widgets/decimal_input.dart';
import '../../../../shared/widgets/kallo_sheet.dart';
import '../../../../shared/widgets/kallo_sheet_header.dart';
import '../../../../shared/widgets/kallo_text.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/manual_log_providers.dart';

/// Open the manual-log sheet: search the food database, enter exact grams,
/// save deterministically — no AI. The Cronometer-style mobile flow.
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
      child: KalloSheetSurface(
        constraints: BoxConstraints(maxHeight: maxHeight),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            KalloSheetHeader(
              title: 'logging.manualLogging.title'.tr(),
              subtitle: 'logging.manualLogging.subtitle'.tr(),
            ),
            const SizedBox(height: KalloSpacing.sp2),

            // Search field.
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp4),
              child: TextField(
                controller: _searchController,
                autofocus: true,
                style: dashBody(),
                cursorColor: KalloColors.accent,
                decoration: InputDecoration(
                  isDense: true,
                  prefixIcon: const Icon(
                    LucideIcons.search300,
                    size: 18,
                    color: KalloColors.textMuted,
                  ),
                  hintText: 'logging.manualLogging.searchPlaceholder'.tr(),
                  hintStyle: dashBody(color: kInkMuted),
                  filled: true,
                  fillColor: KalloColors.elev,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: KalloSpacing.sp3,
                    vertical: KalloSpacing.sp2,
                  ),
                  border: _searchBorder(KalloColors.inputBorder),
                  enabledBorder: _searchBorder(KalloColors.inputBorder),
                  focusedBorder: _searchBorder(KalloColors.borderAccent40),
                ),
              ),
            ),

            // Picked items + search results.
            Flexible(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  KalloSpacing.sp4,
                  KalloSpacing.sp3,
                  KalloSpacing.sp4,
                  KalloSpacing.sp3,
                ),
                children: [
                  Consumer(
                    builder: (context, ref, _) {
                      final state = ref.watch(manualLogProvider);
                      if (state.items.isEmpty) return const SizedBox.shrink();
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          KalloText(
                            'logging.manualLogging.selected'.tr(),
                            variant: KalloTextVariant.eyebrow,
                          ),
                          const SizedBox(height: KalloSpacing.sp2),
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
                          const SizedBox(height: KalloSpacing.sp3),
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
                  horizontal: KalloSpacing.sp4,
                ),
                child: KalloText(
                  _errorText!,
                  variant: KalloTextVariant.small,
                  style: dashMeta(color: KalloColors.danger),
                ),
              ),

            // Pinned totals + save bar.
            Container(
              padding: EdgeInsets.fromLTRB(
                KalloSpacing.sp4,
                KalloSpacing.sp3,
                KalloSpacing.sp4,
                (keyboardInset > 0 ? 0 : bottomInset) + KalloSpacing.sp3,
              ),
              decoration: const BoxDecoration(
                color: KalloColors.elev,
                border: Border(top: BorderSide(color: KalloColors.borderFaint)),
              ),
              child: Consumer(
                builder: (context, ref, _) {
                  final state = ref.watch(manualLogProvider);
                  return Row(
                    children: [
                      Expanded(child: _TotalsSummary(totals: state.totals)),
                      const SizedBox(width: KalloSpacing.sp3),
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
    borderRadius: BorderRadius.circular(KalloRadii.lg),
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
        color: KalloColors.hover,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        (cooked
                ? 'logging.manualLogging.stateCooked'
                : 'logging.manualLogging.stateRaw')
            .tr(),
        style: dashEyebrow(
          color: cooked ? kInk : kInkMuted,
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
      margin: const EdgeInsets.only(bottom: KalloSpacing.sp2),
      padding: const EdgeInsets.all(KalloSpacing.sp2),
      decoration: BoxDecoration(
        color: KalloColors.elev,
        borderRadius: BorderRadius.circular(KalloRadii.lg),
        border: Border.all(color: KalloColors.borderFaint),
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
                      child: KalloText(
                        item.ingredient.namePrimary,
                        variant: KalloTextVariant.itemName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 6),
                    _StateBadge(state: item.ingredient.state),
                  ],
                ),
                const SizedBox(height: 2),
                KalloText(
                  kcal == null
                      ? '—'
                      : '${kcal.round()} ${'logging.manualLogging.kcal'.tr()}',
                  variant: KalloTextVariant.numCaption,
                  style: dashMeta(tabular: true),
                ),
              ],
            ),
          ),
          const SizedBox(width: KalloSpacing.sp2),
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
          KalloText(
            'logging.manualLogging.gramsUnit'.tr(),
            variant: KalloTextVariant.small,
            style: dashMeta(),
          ),
          IconButton(
            onPressed: disabled ? null : onRemove,
            icon: const Icon(LucideIcons.x300, size: 16),
            color: KalloColors.textMuted50,
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
            padding: const EdgeInsets.only(bottom: KalloSpacing.sp2),
            child: KalloText(
              'logging.manualLogging.recentFoods'.tr(),
              variant: KalloTextVariant.eyebrow,
            ),
          ),
        resultsAsync.when(
          loading:
              () => Padding(
                padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp4),
                child: Center(
                  child: KalloText(
                    'logging.manualLogging.searching'.tr(),
                    variant: KalloTextVariant.small,
                    style: dashMeta(),
                  ),
                ),
              ),
          error:
              (_, __) => Padding(
                padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp4),
                child: KalloText(
                  'errors.internal'.tr(),
                  variant: KalloTextVariant.small,
                  style: dashMeta(color: KalloColors.danger),
                ),
              ),
          data: (results) {
            if (results.isEmpty) {
              // An empty recents list just means a new user — nudge them to
              // search rather than show an alarming "no results".
              if (isRecents) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp6),
                  child: Center(
                    child: KalloText(
                      'logging.manualLogging.recentsHint'.tr(),
                      variant: KalloTextVariant.small,
                      style: dashMeta(),
                    ),
                  ),
                );
              }
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp4),
                child: KalloText(
                  'logging.manualLogging.noResults'.tr(),
                  variant: KalloTextVariant.small,
                  style: dashMeta(),
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

class _ResultTile extends StatefulWidget {
  const _ResultTile({required this.result, required this.onTap});

  final IngredientSearchResult result;
  final VoidCallback onTap;

  @override
  State<_ResultTile> createState() => _ResultTileState();
}

class _ResultTileState extends State<_ResultTile> {
  bool _pressed = false;

  void _onTap() {
    HapticFeedback.selectionClick();
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    final result = widget.result;
    final kcal = result.per100g.caloriesKcal;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: _onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        decoration: BoxDecoration(
          color: _pressed ? KalloColors.hover40 : Colors.transparent,
          borderRadius: BorderRadius.circular(KalloRadii.md),
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: KalloSpacing.sp2,
          vertical: KalloSpacing.sp2,
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
                          child: KalloText(
                            result.namePrimary,
                            variant: KalloTextVariant.body,
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
                            style: dashMeta(),
                          ),
                        ],
                      ],
                    ),
                    if (result.nameEn != null && result.nameEn!.isNotEmpty)
                      KalloText(
                        result.nameEn!,
                        variant: KalloTextVariant.small,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: dashMeta(),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: KalloSpacing.sp2),
              KalloText(
                kcal == null
                    ? '—'
                    : '${kcal.round()} ${'logging.manualLogging.kcalPer100g'.tr()}',
                variant: KalloTextVariant.numCaption,
                style: dashMeta(tabular: true),
              ),
              const SizedBox(width: KalloSpacing.sp1),
              const Icon(
                LucideIcons.circlePlus300,
                size: 18,
                color: KalloColors.text,
              ),
            ],
          ),
        ),
      );
  }
}

class _TotalsSummary extends StatelessWidget {
  const _TotalsSummary({required this.totals});

  final IngredientMacrosPer100g totals;

  String _fmt(double? value) => value == null ? '—' : '${value.round()}';
  String _fmtG(double? value) => value == null ? '—' : '${value.round()}g';

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        KalloText(
          '${_fmt(totals.caloriesKcal)} ${'logging.manualLogging.kcal'.tr()}',
          variant: KalloTextVariant.macroValue,
        ),
        const SizedBox(height: 2),
        KalloText(
          'P: ${_fmtG(totals.proteinG)} · C: ${_fmtG(totals.carbohydrateG)} · F: ${_fmtG(totals.fatG)}',
          variant: KalloTextVariant.numCaption,
          style: dashMeta(tabular: true),
        ),
      ],
    );
  }
}

class _SaveButton extends StatefulWidget {
  const _SaveButton({
    required this.enabled,
    required this.saving,
    required this.onTap,
  });

  final bool enabled;
  final bool saving;
  final VoidCallback onTap;

  @override
  State<_SaveButton> createState() => _SaveButtonState();
}

class _SaveButtonState extends State<_SaveButton> {
  bool _pressed = false;

  void _onTap() {
    HapticFeedback.lightImpact();
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.enabled;
    return Semantics(
      button: true,
      enabled: enabled,
      label: 'logging.manualLogging.save'.tr(),
      child: GestureDetector(
        onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
        onTapUp: enabled ? (_) => setState(() => _pressed = false) : null,
        onTapCancel: enabled ? () => setState(() => _pressed = false) : null,
        onTap: enabled ? _onTap : null,
        child: AnimatedScale(
          scale: _pressed ? 0.96 : 1,
          duration: const Duration(milliseconds: 150),
          child: Opacity(
            opacity: enabled ? 1 : 0.4,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: KalloSpacing.sp5,
                vertical: KalloSpacing.sp3,
              ),
              decoration: BoxDecoration(
                color: _pressed ? KalloColors.btnHover : KalloColors.btn,
                borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
              ),
              child: widget.saving
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
                      style: dashBody(
                        color: Colors.white,
                        weight: FontWeight.w500,
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
