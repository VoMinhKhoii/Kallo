import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/barcode_product.dart';
import '../../../../shared/widgets/decimal_input.dart';
import '../../../../shared/widgets/nham_text.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../../../theme/nham_typography.dart';
import '../../logic/barcode_amount.dart';

/// The quantity step of the barcode sheet: pick an amount by serving, whole
/// package, or custom grams — offering only the modes the product actually
/// has sizing for — with a live nutrition preview for the chosen amount.
///
/// Port of the web's `barcode-product-step.tsx`. Owns all amount state; the
/// sheet keys this widget on `product.barcode` so defaults re-initialize on
/// each scan.
class BarcodeProductStep extends StatefulWidget {
  const BarcodeProductStep({
    super.key,
    required this.product,
    required this.saving,
    required this.onBack,
    required this.onConfirm,
    this.errorText,
  });

  final BarcodeProduct product;
  final bool saving;
  final VoidCallback onBack;

  /// Called with the resolved gram amount to log.
  final ValueChanged<int> onConfirm;

  /// Inline save error, shown above the footer so the chosen amount survives
  /// a failed attempt.
  final String? errorText;

  @override
  State<BarcodeProductStep> createState() => _BarcodeProductStepState();
}

class _BarcodeProductStepState extends State<BarcodeProductStep> {
  late final List<BarcodeAmountMode> _modes = availableModes(widget.product);
  late BarcodeAmountMode _mode = _modes.first;
  int _servings = 1;
  late int _customGrams = defaultCustomGrams(widget.product);

  int get _grams => resolveGrams(
    mode: _mode,
    servings: _servings,
    customGrams: _customGrams,
    product: widget.product,
  );

  void _setMode(BarcodeAmountMode mode) {
    if (mode == _mode) return;
    HapticFeedback.selectionClick();
    setState(() => _mode = mode);
  }

  void _adjustServings(int delta) {
    HapticFeedback.selectionClick();
    setState(() => _servings = clampServings(_servings + delta));
  }

  void _adjustGrams(int delta) {
    HapticFeedback.selectionClick();
    setState(() => _customGrams = clampGrams(_customGrams + delta));
  }

  String _modeLabel(BarcodeAmountMode mode) => switch (mode) {
    BarcodeAmountMode.serving => 'logging.barcode.amountServing'.tr(),
    BarcodeAmountMode.package => 'logging.barcode.amountPackage'.tr(),
    BarcodeAmountMode.grams => 'logging.barcode.amountGrams'.tr(),
  };

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final grams = _grams;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Flexible(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(
              NhamSpacing.sp4,
              NhamSpacing.sp2,
              NhamSpacing.sp4,
              NhamSpacing.sp3,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Product header: brand eyebrow + serif name.
                if (product.brand != null && product.brand!.isNotEmpty)
                  NhamText(
                    product.brand!.toUpperCase(),
                    variant: NhamTextVariant.eyebrow,
                  ),
                NhamText(product.name, variant: NhamTextVariant.h3),
                const SizedBox(height: NhamSpacing.sp3),

                // Amount-mode segmented control (only when there's a choice).
                if (_modes.length > 1) ...[
                  NhamText(
                    'logging.barcode.amountModeLabel'.tr(),
                    variant: NhamTextVariant.small,
                    style: NhamTextStyles.sansSemiBold(
                      fontSize: NhamFontSize.xs,
                    ).copyWith(color: NhamColors.text),
                  ),
                  const SizedBox(height: NhamSpacing.sp2),
                  _SegmentedControl(
                    segments: [
                      for (final mode in _modes)
                        (
                          label: _modeLabel(mode),
                          selected: mode == _mode,
                          onTap: () => _setMode(mode),
                        ),
                    ],
                  ),
                  const SizedBox(height: NhamSpacing.sp3),
                ],

                // Amount picker for the selected mode.
                switch (_mode) {
                  BarcodeAmountMode.serving => _ServingPicker(
                    servings: _servings,
                    servingSizeG: product.servingSizeG ?? 0,
                    totalGrams: grams,
                    disabled: widget.saving,
                    onAdjust: _adjustServings,
                  ),
                  BarcodeAmountMode.package => _PackageCard(
                    packageSizeG: product.packageSizeG ?? 0,
                  ),
                  BarcodeAmountMode.grams => _GramsPicker(
                    grams: _customGrams,
                    disabled: widget.saving,
                    onAdjust: _adjustGrams,
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() => _customGrams = clampGrams(value));
                    },
                  ),
                },
                const SizedBox(height: NhamSpacing.sp3),

                _NutritionPreview(product: product, grams: grams),
              ],
            ),
          ),
        ),

        if (widget.errorText != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(
              NhamSpacing.sp4,
              0,
              NhamSpacing.sp4,
              NhamSpacing.sp2,
            ),
            child: Align(
              alignment: Alignment.centerLeft,
              child: NhamText(
                widget.errorText!,
                variant: NhamTextVariant.small,
                style: const TextStyle(color: NhamColors.danger),
              ),
            ),
          ),

        // Pinned footer: back + add meal.
        Container(
          padding: EdgeInsets.fromLTRB(
            NhamSpacing.sp4,
            NhamSpacing.sp3,
            NhamSpacing.sp4,
            MediaQuery.of(context).padding.bottom + NhamSpacing.sp3,
          ),
          decoration: const BoxDecoration(
            color: NhamColors.elev,
            border: Border(top: BorderSide(color: NhamColors.borderFaint)),
          ),
          child: Row(
            children: [
              _BackLink(onTap: widget.saving ? null : widget.onBack),
              const Spacer(),
              _ConfirmButton(
                saving: widget.saving,
                onTap: () => widget.onConfirm(grams),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SegmentedControl extends StatelessWidget {
  const _SegmentedControl({required this.segments});

  final List<({String label, bool selected, VoidCallback onTap})> segments;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: NhamColors.hover,
        borderRadius: BorderRadius.circular(NhamRadii.lg),
      ),
      child: Row(
        children: [
          for (final segment in segments)
            Expanded(
              child: Semantics(
                button: true,
                selected: segment.selected,
                label: segment.label,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: segment.onTap,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(
                      vertical: NhamSpacing.sp2,
                    ),
                    decoration: BoxDecoration(
                      color:
                          segment.selected
                              ? NhamColors.elev
                              : Colors.transparent,
                      borderRadius: BorderRadius.circular(NhamRadii.md),
                      boxShadow:
                          segment.selected
                              ? [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.06),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                              ]
                              : null,
                    ),
                    child: Center(
                      child: Text(
                        segment.label,
                        style: NhamTextStyles.sansSemiBold(
                          fontSize: NhamFontSize.xs,
                        ).copyWith(
                          color:
                              segment.selected
                                  ? NhamColors.text
                                  : NhamColors.textMuted,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _StepperButton extends StatelessWidget {
  const _StepperButton({required this.icon, required this.label, this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: Opacity(
          opacity: enabled ? 1 : 0.4,
          child: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: NhamColors.elev,
              borderRadius: BorderRadius.circular(NhamRadii.lg),
              border: Border.all(color: NhamColors.inputBorder),
            ),
            child: Icon(icon, size: 18, color: NhamColors.text),
          ),
        ),
      ),
    );
  }
}

class _ServingPicker extends StatelessWidget {
  const _ServingPicker({
    required this.servings,
    required this.servingSizeG,
    required this.totalGrams,
    required this.disabled,
    required this.onAdjust,
  });

  final int servings;
  final double servingSizeG;
  final int totalGrams;
  final bool disabled;
  final ValueChanged<int> onAdjust;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _StepperButton(
              icon: LucideIcons.minus,
              label: 'logging.barcode.decreaseServings'.tr(),
              onTap: disabled || servings <= 1 ? null : () => onAdjust(-1),
            ),
            Expanded(
              child: Center(
                child: NhamText(
                  '$servings',
                  variant: NhamTextVariant.macroValue,
                ),
              ),
            ),
            _StepperButton(
              icon: LucideIcons.plus,
              label: 'logging.barcode.increaseServings'.tr(),
              onTap:
                  disabled || servings >= maxServings
                      ? null
                      : () => onAdjust(1),
            ),
          ],
        ),
        const SizedBox(height: NhamSpacing.sp1),
        NhamText(
          '${'logging.barcode.perServing'.tr(namedArgs: {'grams': '${servingSizeG.round()}'})} · ${'logging.barcode.totalGrams'.tr(namedArgs: {'grams': '$totalGrams'})}',
          variant: NhamTextVariant.numCaption,
          style: const TextStyle(color: NhamColors.textMuted),
        ),
      ],
    );
  }
}

class _PackageCard extends StatelessWidget {
  const _PackageCard({required this.packageSizeG});

  final double packageSizeG;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(NhamSpacing.sp3),
      decoration: BoxDecoration(
        color: NhamColors.elev,
        borderRadius: BorderRadius.circular(NhamRadii.lg),
        border: Border.all(color: NhamColors.borderFaint),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          NhamText(
            'logging.barcode.wholePackage'.tr(),
            variant: NhamTextVariant.itemName,
          ),
          const SizedBox(height: 2),
          NhamText(
            'logging.barcode.totalGrams'.tr(
              namedArgs: {'grams': '${packageSizeG.round()}'},
            ),
            variant: NhamTextVariant.numCaption,
            style: const TextStyle(color: NhamColors.textMuted),
          ),
        ],
      ),
    );
  }
}

class _GramsPicker extends StatelessWidget {
  const _GramsPicker({
    required this.grams,
    required this.disabled,
    required this.onAdjust,
    required this.onChanged,
  });

  final int grams;
  final bool disabled;
  final ValueChanged<int> onAdjust;
  final ValueChanged<double?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _StepperButton(
              icon: LucideIcons.minus,
              label: 'logging.barcode.decreaseGrams'.tr(),
              onTap: disabled || grams <= 1 ? null : () => onAdjust(-gramStep),
            ),
            const SizedBox(width: NhamSpacing.sp2),
            Expanded(
              child: DecimalInput(
                // Keyed so stepper taps (which change state outside the
                // field) refresh the text.
                key: ValueKey(grams),
                value: grams.toDouble(),
                integer: true,
                onValueChange: disabled ? (_) {} : onChanged,
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(width: NhamSpacing.sp2),
            _StepperButton(
              icon: LucideIcons.plus,
              label: 'logging.barcode.increaseGrams'.tr(),
              onTap:
                  disabled || grams >= maxFoodItemGrams
                      ? null
                      : () => onAdjust(gramStep),
            ),
          ],
        ),
        const SizedBox(height: NhamSpacing.sp2),
        // Quick one-tap portions.
        Wrap(
          spacing: NhamSpacing.sp2,
          runSpacing: NhamSpacing.sp1,
          children: [
            for (final option in quickGramOptions)
              _QuickChip(
                label: '${option}g',
                selected: grams == option,
                onTap:
                    disabled
                        ? null
                        : () {
                          HapticFeedback.selectionClick();
                          onChanged(option.toDouble());
                        },
              ),
          ],
        ),
      ],
    );
  }
}

class _QuickChip extends StatelessWidget {
  const _QuickChip({required this.label, required this.selected, this.onTap});

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp3,
            // Tap-target height: ~40px with the xs label, close to the app's
            // 44pt convention — the previous 6px made ~30px chips in a tight
            // row, inviting mis-taps.
            vertical: 10,
          ),
          decoration: BoxDecoration(
            color: selected ? NhamColors.hover : NhamColors.elev,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected ? NhamColors.border : NhamColors.inputBorder,
            ),
          ),
          child: Text(
            label,
            style: NhamTextStyles.sansMedium(
              fontSize: NhamFontSize.xs,
            ).copyWith(
              color: selected ? NhamColors.text : NhamColors.textMuted,
            ),
          ),
        ),
      ),
    );
  }
}

class _NutritionPreview extends StatelessWidget {
  const _NutritionPreview({required this.product, required this.grams});

  final BarcodeProduct product;
  final int grams;

  String _fmt(double? value) => value == null ? '—' : '$value';

  @override
  Widget build(BuildContext context) {
    final calories = scalePer100(product.caloriesKcal, grams, decimals: 0);
    final macros = [
      (
        label: 'logging.barcode.protein'.tr(),
        value: scalePer100(product.proteinG, grams),
      ),
      (
        label: 'logging.barcode.carbs'.tr(),
        value: scalePer100(product.carbohydrateG, grams),
      ),
      (
        label: 'logging.barcode.fat'.tr(),
        value: scalePer100(product.fatG, grams),
      ),
    ];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(NhamSpacing.sp3),
      decoration: BoxDecoration(
        color: NhamColors.elev,
        borderRadius: BorderRadius.circular(NhamRadii.containerLg),
        border: Border.all(color: NhamColors.borderSoft),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          NhamText(
            'logging.barcode.nutritionForAmount'.tr(
              namedArgs: {'grams': '$grams'},
            ),
            variant: NhamTextVariant.eyebrow,
          ),
          const SizedBox(height: NhamSpacing.sp2),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              NhamText(
                calories == null ? '—' : '${calories.round()}',
                variant: NhamTextVariant.h3,
                style: NhamTextStyles.serifRegular(
                  fontSize: NhamFontSize.h2,
                ).copyWith(color: NhamColors.text),
              ),
              const SizedBox(width: 4),
              NhamText(
                'logging.manualLogging.kcal'.tr(),
                variant: NhamTextVariant.small,
                style: const TextStyle(color: NhamColors.textMuted),
              ),
            ],
          ),
          const SizedBox(height: NhamSpacing.sp2),
          Row(
            children: [
              for (final macro in macros)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      NhamText(
                        macro.label,
                        variant: NhamTextVariant.small,
                        style: const TextStyle(color: NhamColors.textMuted),
                      ),
                      const SizedBox(height: 2),
                      NhamText(
                        macro.value == null ? '—' : '${_fmt(macro.value)}g',
                        variant: NhamTextVariant.macroValue,
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _BackLink extends StatelessWidget {
  const _BackLink({this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: onTap != null,
      label: 'logging.barcode.back'.tr(),
      child: GestureDetector(
        onTap: onTap,
        child: SizedBox(
          height: 44,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                LucideIcons.arrowLeft,
                size: 16,
                color: NhamColors.textMuted,
              ),
              const SizedBox(width: 6),
              Text(
                'logging.barcode.back'.tr(),
                style: NhamTextStyles.sansMedium(
                  fontSize: NhamFontSize.sm,
                ).copyWith(color: NhamColors.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ConfirmButton extends StatefulWidget {
  const _ConfirmButton({required this.saving, required this.onTap});

  final bool saving;
  final VoidCallback onTap;

  @override
  State<_ConfirmButton> createState() => _ConfirmButtonState();
}

class _ConfirmButtonState extends State<_ConfirmButton> {
  bool _pressed = false;

  void _onTap() {
    HapticFeedback.lightImpact();
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    final enabled = !widget.saving;
    return Semantics(
      button: true,
      enabled: enabled,
      label: 'logging.barcode.addMeal'.tr(),
      child: GestureDetector(
        onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
        onTapUp: enabled ? (_) => setState(() => _pressed = false) : null,
        onTapCancel: enabled ? () => setState(() => _pressed = false) : null,
        onTap: enabled ? _onTap : null,
        child: AnimatedScale(
          scale: _pressed ? 0.96 : 1,
          duration: const Duration(milliseconds: 150),
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: NhamSpacing.sp5,
              vertical: NhamSpacing.sp3,
            ),
            decoration: BoxDecoration(
              color: _pressed ? NhamColors.btnHover : NhamColors.btn,
              borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
            ),
            child:
                widget.saving
                    ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                    : Text(
                      'logging.barcode.addMeal'.tr(),
                      style: NhamTextStyles.sansSemiBold(
                        fontSize: NhamFontSize.sm,
                      ).copyWith(color: Colors.white),
                    ),
          ),
        ),
      ),
    );
  }
}
