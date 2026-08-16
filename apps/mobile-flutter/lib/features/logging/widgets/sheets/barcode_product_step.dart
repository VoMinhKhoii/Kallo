import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/barcode_product.dart';
import '../../../../shared/widgets/decimal_input.dart';
import '../../../../shared/widgets/kallo_text.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../theme/kallo_typography.dart';
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
              KalloSpacing.sp4,
              KalloSpacing.sp2,
              KalloSpacing.sp4,
              KalloSpacing.sp3,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Product header: brand eyebrow + serif name.
                if (product.brand != null && product.brand!.isNotEmpty)
                  KalloText(
                    product.brand!.toUpperCase(),
                    variant: KalloTextVariant.eyebrow,
                  ),
                KalloText(product.name, variant: KalloTextVariant.h3),
                const SizedBox(height: KalloSpacing.sp3),

                // Amount-mode segmented control (only when there's a choice).
                if (_modes.length > 1) ...[
                  KalloText(
                    'logging.barcode.amountModeLabel'.tr(),
                    variant: KalloTextVariant.small,
                    style: KalloTextStyles.sansSemiBold(
                      fontSize: KalloFontSize.xs,
                    ).copyWith(color: KalloColors.text),
                  ),
                  const SizedBox(height: KalloSpacing.sp2),
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
                  const SizedBox(height: KalloSpacing.sp3),
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
                const SizedBox(height: KalloSpacing.sp3),

                _NutritionPreview(product: product, grams: grams),
              ],
            ),
          ),
        ),

        if (widget.errorText != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(
              KalloSpacing.sp4,
              0,
              KalloSpacing.sp4,
              KalloSpacing.sp2,
            ),
            child: Align(
              alignment: Alignment.centerLeft,
              child: KalloText(
                widget.errorText!,
                variant: KalloTextVariant.small,
                style: const TextStyle(color: KalloColors.danger),
              ),
            ),
          ),

        // Pinned footer: back + add meal.
        Container(
          padding: EdgeInsets.fromLTRB(
            KalloSpacing.sp4,
            KalloSpacing.sp3,
            KalloSpacing.sp4,
            MediaQuery.of(context).padding.bottom + KalloSpacing.sp3,
          ),
          decoration: const BoxDecoration(
            color: KalloColors.elev,
            border: Border(top: BorderSide(color: KalloColors.borderFaint)),
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
        color: KalloColors.hover,
        borderRadius: BorderRadius.circular(KalloRadii.lg),
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
                      vertical: KalloSpacing.sp2,
                    ),
                    decoration: BoxDecoration(
                      color:
                          segment.selected
                              ? KalloColors.elev
                              : Colors.transparent,
                      borderRadius: BorderRadius.circular(KalloRadii.md),
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
                        style: KalloTextStyles.sansSemiBold(
                          fontSize: KalloFontSize.xs,
                        ).copyWith(
                          color:
                              segment.selected
                                  ? KalloColors.text
                                  : KalloColors.textMuted,
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
              color: KalloColors.elev,
              borderRadius: BorderRadius.circular(KalloRadii.lg),
              border: Border.all(color: KalloColors.inputBorder),
            ),
            child: Icon(icon, size: 18, color: KalloColors.text),
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
              icon: LucideIcons.minus300,
              label: 'logging.barcode.decreaseServings'.tr(),
              onTap: disabled || servings <= 1 ? null : () => onAdjust(-1),
            ),
            Expanded(
              child: Center(
                child: KalloText(
                  '$servings',
                  variant: KalloTextVariant.macroValue,
                ),
              ),
            ),
            _StepperButton(
              icon: LucideIcons.plus300,
              label: 'logging.barcode.increaseServings'.tr(),
              onTap:
                  disabled || servings >= maxServings
                      ? null
                      : () => onAdjust(1),
            ),
          ],
        ),
        const SizedBox(height: KalloSpacing.sp1),
        KalloText(
          '${'logging.barcode.perServing'.tr(namedArgs: {'grams': '${servingSizeG.round()}'})} · ${'logging.barcode.totalGrams'.tr(namedArgs: {'grams': '$totalGrams'})}',
          variant: KalloTextVariant.numCaption,
          style: const TextStyle(color: KalloColors.textMuted),
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
      padding: const EdgeInsets.all(KalloSpacing.sp3),
      decoration: BoxDecoration(
        color: KalloColors.elev,
        borderRadius: BorderRadius.circular(KalloRadii.lg),
        border: Border.all(color: KalloColors.borderFaint),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          KalloText(
            'logging.barcode.wholePackage'.tr(),
            variant: KalloTextVariant.itemName,
          ),
          const SizedBox(height: 2),
          KalloText(
            'logging.barcode.totalGrams'.tr(
              namedArgs: {'grams': '${packageSizeG.round()}'},
            ),
            variant: KalloTextVariant.numCaption,
            style: const TextStyle(color: KalloColors.textMuted),
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
              icon: LucideIcons.minus300,
              label: 'logging.barcode.decreaseGrams'.tr(),
              onTap: disabled || grams <= 1 ? null : () => onAdjust(-gramStep),
            ),
            const SizedBox(width: KalloSpacing.sp2),
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
            const SizedBox(width: KalloSpacing.sp2),
            _StepperButton(
              icon: LucideIcons.plus300,
              label: 'logging.barcode.increaseGrams'.tr(),
              onTap:
                  disabled || grams >= maxFoodItemGrams
                      ? null
                      : () => onAdjust(gramStep),
            ),
          ],
        ),
        const SizedBox(height: KalloSpacing.sp2),
        // Quick one-tap portions.
        Wrap(
          spacing: KalloSpacing.sp2,
          runSpacing: KalloSpacing.sp1,
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
            horizontal: KalloSpacing.sp3,
            // Tap-target height: ~40px with the xs label, close to the app's
            // 44pt convention — the previous 6px made ~30px chips in a tight
            // row, inviting mis-taps.
            vertical: 10,
          ),
          decoration: BoxDecoration(
            color: selected ? KalloColors.hover : KalloColors.elev,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected ? KalloColors.border : KalloColors.inputBorder,
            ),
          ),
          child: Text(
            label,
            style: KalloTextStyles.sansMedium(
              fontSize: KalloFontSize.xs,
            ).copyWith(
              color: selected ? KalloColors.text : KalloColors.textMuted,
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
      padding: const EdgeInsets.all(KalloSpacing.sp3),
      decoration: BoxDecoration(
        color: KalloColors.elev,
        borderRadius: BorderRadius.circular(KalloRadii.containerLg),
        border: Border.all(color: KalloColors.borderSoft),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          KalloText(
            'logging.barcode.nutritionForAmount'.tr(
              namedArgs: {'grams': '$grams'},
            ),
            variant: KalloTextVariant.eyebrow,
          ),
          const SizedBox(height: KalloSpacing.sp2),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              KalloText(
                calories == null ? '—' : '${calories.round()}',
                variant: KalloTextVariant.h3,
                style: KalloTextStyles.serifRegular(
                  fontSize: KalloFontSize.h2,
                ).copyWith(color: KalloColors.text),
              ),
              const SizedBox(width: 4),
              KalloText(
                'logging.manualLogging.kcal'.tr(),
                variant: KalloTextVariant.small,
                style: const TextStyle(color: KalloColors.textMuted),
              ),
            ],
          ),
          const SizedBox(height: KalloSpacing.sp2),
          Row(
            children: [
              for (final macro in macros)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      KalloText(
                        macro.label,
                        variant: KalloTextVariant.small,
                        style: const TextStyle(color: KalloColors.textMuted),
                      ),
                      const SizedBox(height: 2),
                      KalloText(
                        macro.value == null ? '—' : '${_fmt(macro.value)}g',
                        variant: KalloTextVariant.macroValue,
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
                LucideIcons.arrowLeft300,
                size: 16,
                color: KalloColors.textMuted,
              ),
              const SizedBox(width: 6),
              Text(
                'logging.barcode.back'.tr(),
                style: KalloTextStyles.sansMedium(
                  fontSize: KalloFontSize.sm,
                ).copyWith(color: KalloColors.textMuted),
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
              horizontal: KalloSpacing.sp5,
              vertical: KalloSpacing.sp3,
            ),
            decoration: BoxDecoration(
              color: _pressed ? KalloColors.btnHover : KalloColors.btn,
              borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
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
                      style: KalloTextStyles.sansSemiBold(
                        fontSize: KalloFontSize.sm,
                      ).copyWith(color: Colors.white),
                    ),
          ),
        ),
      ),
    );
  }
}
