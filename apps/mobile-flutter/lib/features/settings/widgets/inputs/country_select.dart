import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../shared/data/countries.dart';

/// Port of the web inline `CountrySelect` (regional.tsx). A searchable,
/// inline-anchored dropdown over [kCountries], filtering on English +
/// Vietnamese name, displaying `"{value} ({vi})"`, clearable.
///
/// Trigger: cream pill, `rounded-xl` (12), `py-2.5 pl-4` (pr-10 when a value is
/// set, else pr-4), `inputBorder` border (→ `accent` + white bg on open,
/// `accent50` on press). The popover opens `mt-1` (4px) below the trigger at
/// trigger width: search header + a `max-h-48` (192px) scrollable list, no dim.
class CountrySelect extends StatefulWidget {
  const CountrySelect({super.key, required this.value, required this.onChange});

  final String? value;
  final ValueChanged<String?> onChange;

  @override
  State<CountrySelect> createState() => _CountrySelectState();
}

class _CountrySelectState extends State<CountrySelect> {
  final LayerLink _link = LayerLink();
  final GlobalKey _triggerKey = GlobalKey();
  OverlayEntry? _entry;
  bool _open = false;
  bool _pressed = false;
  bool _clearPressed = false;

  @override
  void dispose() {
    _removeOverlay();
    super.dispose();
  }

  void _toggle() {
    if (_open) {
      _close();
    } else {
      _openOverlay();
    }
  }

  void _openOverlay() {
    final box = _triggerKey.currentContext?.findRenderObject() as RenderBox?;
    final width = box?.size.width ?? 0;
    _entry = OverlayEntry(
      builder:
          (_) => _CountryDropdown(
            link: _link,
            width: width,
            selectedValue: widget.value,
            onPick: (v) {
              widget.onChange(v);
              _close();
            },
            onDismiss: _close,
          ),
    );
    Overlay.of(context).insert(_entry!);
    setState(() => _open = true);
  }

  void _close() {
    _removeOverlay();
    if (mounted) setState(() => _open = false);
  }

  void _removeOverlay() {
    _entry?.remove();
    _entry = null;
  }

  @override
  Widget build(BuildContext context) {
    final selected =
        kCountries
            .where((c) => c.value == widget.value)
            .map((c) => c.vi)
            .firstOrNull;
    final hasValue = widget.value != null;
    final triggerLabel =
        hasValue
            ? (selected != null ? '${widget.value} ($selected)' : widget.value!)
            : tr('onboarding.origin.selectCountry');

    final borderColor =
        _open
            ? KalloColors.accent
            : (_pressed ? KalloColors.accent50 : KalloColors.inputBorder);

    return Semantics(
      button: true,
      excludeSemantics: true,
      label: triggerLabel,
      onTap: _toggle,
      child: CompositedTransformTarget(
        link: _link,
        child: Stack(
          children: [
            GestureDetector(
              onTap: _toggle,
              onTapDown: (_) => setState(() => _pressed = true),
              onTapUp: (_) => setState(() => _pressed = false),
              onTapCancel: () => setState(() => _pressed = false),
              child: Container(
                key: _triggerKey,
                width: double.infinity,
                // py-2.5 pl-4 pr-(10|4)
                padding: EdgeInsets.fromLTRB(
                  KalloSpacing.sp4,
                  10,
                  hasValue ? 40 : KalloSpacing.sp4,
                  10,
                ),
                decoration: BoxDecoration(
                  color: _open ? KalloColors.elev : KalloColors.cream,
                  borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
                  border: Border.all(color: borderColor),
                ),
                child: Text(
                  triggerLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: dashBody(color: hasValue ? kInk : kInkMuted),
                ),
              ),
            ),
            if (hasValue)
              // Clear button overlay: right 10px, vertically centered, rounded-md
              // p-1, '×' glyph, color textWarm → text on press.
              Positioned(
                right: 10,
                top: 0,
                bottom: 0,
                child: Center(
                  child: Semantics(
                    button: true,
                    excludeSemantics: true,
                    label: tr('common.remove'),
                    onTap: () => widget.onChange(null),
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => widget.onChange(null),
                      onTapDown: (_) => setState(() => _clearPressed = true),
                      onTapUp: (_) => setState(() => _clearPressed = false),
                      onTapCancel: () => setState(() => _clearPressed = false),
                      child: Container(
                        padding: const EdgeInsets.all(KalloSpacing.sp1), // p-1
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(KalloRadii.md),
                        ),
                        child: Text(
                          '×', // ×
                          style: dashBody().copyWith(
                            height: 1,
                            color:
                                _clearPressed
                                    ? kInk
                                    : kInkMuted,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _CountryDropdown extends StatefulWidget {
  const _CountryDropdown({
    required this.link,
    required this.width,
    required this.selectedValue,
    required this.onPick,
    required this.onDismiss,
  });

  final LayerLink link;
  final double width;
  final String? selectedValue;
  final ValueChanged<String?> onPick;
  final VoidCallback onDismiss;

  @override
  State<_CountryDropdown> createState() => _CountryDropdownState();
}

class _CountryDropdownState extends State<_CountryDropdown> {
  final TextEditingController _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Through the shared matcher, so "duc" finds Đức here exactly as it does
    // in onboarding's country sheet — one folding rule, not two.
    final filtered =
        kCountries.where((c) => countryMatches(c, _query)).toList();
    final language = context.locale.languageCode;

    return Stack(
      children: [
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: widget.onDismiss,
          ),
        ),
        CompositedTransformFollower(
          link: widget.link,
          showWhenUnlinked: false,
          targetAnchor: Alignment.bottomLeft,
          followerAnchor: Alignment.topLeft,
          offset: const Offset(0, 4), // mt-1
          child: Align(
            alignment: Alignment.topLeft,
            child: SizedBox(
              width: widget.width,
              child: Material(
                color: Colors.transparent,
                child: Container(
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    color: KalloColors.elev,
                    borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
                    border: Border.all(color: KalloColors.inputBorder),
                    boxShadow: const [
                      // shadow-lg
                      BoxShadow(
                        color: Color(0x1A000000),
                        blurRadius: 15,
                        offset: Offset(0, 10),
                      ),
                      BoxShadow(
                        color: Color(0x14000000),
                        blurRadius: 6,
                        offset: Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Search header — p-2, border-b
                      Container(
                        padding: const EdgeInsets.all(KalloSpacing.sp2),
                        decoration:
                            const Border(
                              bottom: BorderSide(color: KalloColors.inputBorder),
                            ).toBoxDecoration(),
                        child: TextField(
                          controller: _search,
                          autofocus: true,
                          onChanged: (v) => setState(() => _query = v),
                          style: dashBody(),
                          decoration: InputDecoration(
                            isDense: true,
                            filled: true,
                            fillColor: KalloColors.track,
                            hintText: tr('onboarding.origin.searchCountry'),
                            hintStyle: dashBody(color: kInkMuted),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: KalloSpacing.sp3,
                              vertical: KalloSpacing.sp2,
                            ),
                            border: _searchBorder(),
                            enabledBorder: _searchBorder(),
                            focusedBorder: _searchBorder(),
                          ),
                        ),
                      ),
                      // List — max-h-48 (192px), p-1
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxHeight: 192),
                        child:
                            filtered.isEmpty
                                ? Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: KalloSpacing.sp3,
                                    vertical: KalloSpacing.sp2,
                                  ),
                                  child: Text(
                                    tr('onboarding.origin.noCountries'),
                                    textAlign: TextAlign.center,
                                    style: dashMeta(),
                                  ),
                                )
                                : ListView.builder(
                                  padding: const EdgeInsets.all(
                                    KalloSpacing.sp1,
                                  ),
                                  shrinkWrap: true,
                                  keyboardDismissBehavior:
                                      ScrollViewKeyboardDismissBehavior.onDrag,
                                  itemCount: filtered.length,
                                  itemBuilder: (_, i) {
                                    final c = filtered[i];
                                    return _CountryRow(
                                      label: countryLabel(c, language),
                                      vi: countryAlias(c, language),
                                      selected: widget.selectedValue == c.value,
                                      onTap: () => widget.onPick(c.value),
                                    );
                                  },
                                ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  OutlineInputBorder _searchBorder() => OutlineInputBorder(
    borderRadius: BorderRadius.circular(KalloRadii.lg), // rounded-lg = 10
    borderSide: BorderSide.none,
  );
}

class _CountryRow extends StatefulWidget {
  const _CountryRow({
    required this.label,
    required this.vi,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final String vi;
  final bool selected;
  final VoidCallback onTap;

  @override
  State<_CountryRow> createState() => _CountryRowState();
}

class _CountryRowState extends State<_CountryRow> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final Color? bg =
        widget.selected
            ? KalloColors.accent10
            : (_pressed ? KalloColors.track : null);

    return Semantics(
      button: true,
      selected: widget.selected,
      excludeSemantics: true,
      label: '${widget.label}, ${widget.vi}',
      onTap: widget.onTap,
      child: GestureDetector(
        onTap: widget.onTap,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(
              KalloRadii.lg,
            ), // rounded-lg = 10
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: KalloSpacing.sp3,
            vertical: KalloSpacing.sp2,
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  widget.label,
                  style: dashBody(
                  ),
                ),
              ),
              Text(
                widget.vi,
                style: dashMeta(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

extension on Border {
  BoxDecoration toBoxDecoration() => BoxDecoration(border: this);
}
