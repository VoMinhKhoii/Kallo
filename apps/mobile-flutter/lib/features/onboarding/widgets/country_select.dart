import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/kallo_sheet.dart';
import '../../../shared/widgets/kallo_sheet_header.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../data/countries.dart';

/// ISO values pinned above the alphabet — Việt Nam first, then the destinations
/// most Kallo users live in. Keeps Việt Nam one tap away instead of buried at "V".
const List<String> _pinnedValues = [
  'Vietnam',
  'United States',
  'Australia',
  'Japan',
  'South Korea',
  'Singapore',
];

/// Country picker for onboarding `screen-origin`.
///
/// Replaces the anchored popover (which opened alphabetically at Afghanistan,
/// auto-focused a search whose keyboard covered the list, and pinned nothing)
/// with a native modal bottom sheet: a grabber, a pinned search that stays above
/// the keyboard, a "Common" section (Việt Nam + frequent residences) above the
/// full alphabetical list, and a sheet that grows with the keyboard so the list
/// is never occluded.
class CountrySelect extends StatefulWidget {
  const CountrySelect({super.key, required this.value, required this.onChange});

  final String? value;
  final ValueChanged<String?> onChange;

  @override
  State<CountrySelect> createState() => _CountrySelectState();
}

class _CountrySelectState extends State<CountrySelect> {
  Country? get _selected {
    if (widget.value == null) return null;
    return kCountries.cast<Country?>().firstWhere(
          (c) => c?.value == widget.value,
          orElse: () => null,
        );
  }

  Future<void> _open() async {
    HapticFeedback.selectionClick();
    final picked = await showNhamSheet<String>(
      context,
      isScrollControlled: true,
      barrierColor: KalloColors.text40,
      builder: (_) => _CountrySheet(selectedValue: widget.value),
    );
    if (picked != null) widget.onChange(picked);
  }

  @override
  Widget build(BuildContext context) {
    final hasValue = widget.value != null && widget.value!.isNotEmpty;
    final display = hasValue
        ? (_selected != null
            ? '${widget.value} (${_selected!.vi})'
            : widget.value!)
        : tr('onboarding.origin.selectCountry');

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _open,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: KalloSpacing.sp4,
          vertical: KalloSpacing.sp3,
        ),
        decoration: BoxDecoration(
          color: KalloColors.cream,
          borderRadius: BorderRadius.circular(KalloRadii.containerLg),
          border: Border.all(color: KalloColors.inputBorder),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                display,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: dashBody(color: hasValue ? kInk : kInkMuted),
              ),
            ),
            const SizedBox(width: KalloSpacing.sp2),
            const Icon(
              LucideIcons.chevronDown300,
              size: 16,
              color: KalloColors.textHelp,
            ),
          ],
        ),
      ),
    );
  }
}

class _CountrySheet extends StatefulWidget {
  const _CountrySheet({required this.selectedValue});

  final String? selectedValue;

  @override
  State<_CountrySheet> createState() => _CountrySheetState();
}

class _CountrySheetState extends State<_CountrySheet> {
  final TextEditingController _search = TextEditingController();
  String _query = '';

  static final List<Country> _pinned = [
    for (final v in _pinnedValues)
      kCountries.firstWhere((c) => c.value == v),
  ];

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final q = _query.trim().toLowerCase();
    final searching = q.isNotEmpty;
    final filtered = searching
        ? kCountries
            .where((c) =>
                c.value.toLowerCase().contains(q) ||
                c.vi.toLowerCase().contains(q))
            .toList()
        : kCountries;

    // Keyboard inset → the sheet lifts so the pinned search + list clear it.
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: FractionallySizedBox(
        heightFactor: 0.85,
        child: KalloSheetSurface(
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              KalloSheetHeader(title: tr('common.country')),
              // Pinned search.
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: TextField(
                  controller: _search,
                  autofocus: false,
                  onChanged: (v) => setState(() => _query = v),
                  cursorColor: KalloColors.accent,
                  style: dashBody(),
                  decoration: InputDecoration(
                    isDense: true,
                    filled: true,
                    fillColor: KalloColors.track,
                    prefixIcon: const Icon(
                      LucideIcons.search300,
                      size: 16,
                      color: KalloColors.textHelp,
                    ),
                    hintText: tr('onboarding.origin.searchCountry'),
                    hintStyle: dashBody(color: kInkMuted),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: KalloSpacing.sp3,
                      vertical: KalloSpacing.sp3,
                    ),
                    border: _border(),
                    enabledBorder: _border(),
                    focusedBorder: _border(),
                  ),
                ),
              ),
              const _SheetDivider(),
              Expanded(
                child: filtered.isEmpty
                    ? Center(
                        child: Text(
                          tr('onboarding.origin.noCountries'),
                          style: dashBody(color: kInkMuted),
                        ),
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(8, 8, 8, 24),
                        keyboardDismissBehavior:
                            ScrollViewKeyboardDismissBehavior.onDrag,
                        children: [
                          if (!searching) ...[
                            _SectionLabel(
                              tr('onboarding.origin.commonCountries'),
                            ),
                            for (final c in _pinned)
                              _OptionRow(
                                country: c,
                                selected: widget.selectedValue == c.value,
                                onTap: () => Navigator.of(context).pop(c.value),
                              ),
                            const SizedBox(height: 8),
                            const _SheetDivider(),
                            const SizedBox(height: 8),
                          ],
                          for (final c in filtered)
                            _OptionRow(
                              country: c,
                              selected: widget.selectedValue == c.value,
                              onTap: () => Navigator.of(context).pop(c.value),
                            ),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  OutlineInputBorder _border() => OutlineInputBorder(
        borderRadius: BorderRadius.circular(KalloRadii.md),
        borderSide: BorderSide.none,
      );
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 6),
      child: Text(
        text.toUpperCase(),
        style: dashEyebrow(),
      ),
    );
  }
}

class _SheetDivider extends StatelessWidget {
  const _SheetDivider();

  @override
  Widget build(BuildContext context) =>
      Container(height: 1, color: KalloColors.inputBorder);
}

class _OptionRow extends StatefulWidget {
  const _OptionRow({
    required this.country,
    required this.selected,
    required this.onTap,
  });

  final Country country;
  final bool selected;
  final VoidCallback onTap;

  @override
  State<_OptionRow> createState() => _OptionRowState();
}

class _OptionRowState extends State<_OptionRow> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final Color fill = widget.selected
        ? KalloColors.accent10
        : (_pressed ? KalloColors.track : Colors.transparent);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: Container(
        decoration: BoxDecoration(
          color: fill,
          borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: KalloSpacing.sp3,
          vertical: KalloSpacing.sp3,
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                widget.country.value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: dashBody(
                  weight: widget.selected ? FontWeight.w500 : FontWeight.w400,
                ),
              ),
            ),
            const SizedBox(width: KalloSpacing.sp3),
            Text(
              widget.country.vi,
              style: dashMeta(),
            ),
            if (widget.selected) ...[
              const SizedBox(width: KalloSpacing.sp2),
              const Icon(LucideIcons.check300, size: 16, color: KalloColors.text),
            ],
          ],
        ),
      ),
    );
  }
}
