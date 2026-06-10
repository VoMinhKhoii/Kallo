import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../data/countries.dart';

/// Mirror of `components/onboarding/screen-origin.tsx` CountryPicker.
///
/// An anchored popover dropdown glued to the trigger: portal-positioned at the
/// trigger bottom (+8px, flipped above when no room), same width as the trigger,
/// rounded-2xl, border #EAE7E0, shadow [0_20px_60px_rgba(44,36,22,0.18)], a
/// search input pinned at top, and a scroll list clamped to maxHeight 160..320.
class CountrySelect extends StatefulWidget {
  const CountrySelect({super.key, required this.value, required this.onChange});

  final String? value;
  final ValueChanged<String?> onChange;

  @override
  State<CountrySelect> createState() => _CountrySelectState();
}

class _CountrySelectState extends State<CountrySelect>
    with SingleTickerProviderStateMixin {
  final OverlayPortalController _portal = OverlayPortalController();
  final LayerLink _link = LayerLink();
  final TextEditingController _search = TextEditingController();
  final GlobalKey _triggerKey = GlobalKey();

  late final AnimationController _chevron = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 200),
  );

  bool _open = false;
  String _query = '';
  bool _flipAbove = false;
  double _maxHeight = 320;
  double _triggerWidth = 0;

  @override
  void dispose() {
    _chevron.dispose();
    _search.dispose();
    super.dispose();
  }

  Country? get _selected {
    if (widget.value == null) return null;
    return kCountries.cast<Country?>().firstWhere(
          (c) => c?.value == widget.value,
          orElse: () => null,
        );
  }

  void _toggle() {
    if (_open) {
      _close();
    } else {
      _computePlacement();
      setState(() => _open = true);
      _portal.show();
      _chevron.forward();
    }
  }

  void _close() {
    _chevron.reverse();
    _portal.hide();
    _search.clear();
    setState(() {
      _open = false;
      _query = '';
    });
  }

  void _computePlacement() {
    final box = _triggerKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null) return;
    final screenH = MediaQuery.sizeOf(context).height;
    final topLeft = box.localToGlobal(Offset.zero);
    final spaceBelow = screenH - (topLeft.dy + box.size.height);
    final spaceAbove = topLeft.dy;
    _triggerWidth = box.size.width;
    // Flip above when no room below (mirrors web: spaceBelow<180 &&
    // spaceAbove>spaceBelow+40).
    _flipAbove = spaceBelow < 180 && spaceAbove > spaceBelow + 40;
    final avail = (_flipAbove ? spaceAbove : spaceBelow) - 16;
    _maxHeight = avail.clamp(160.0, 320.0);
  }

  @override
  Widget build(BuildContext context) {
    final hasValue = widget.value != null && widget.value!.isNotEmpty;
    final display = hasValue
        ? (_selected != null ? '${widget.value} (${_selected!.vi})' : widget.value!)
        : tr('onboarding.origin.selectCountry');

    return CompositedTransformTarget(
      link: _link,
      child: OverlayPortal(
        controller: _portal,
        overlayChildBuilder: _buildOverlay,
        child: GestureDetector(
          key: _triggerKey,
          behavior: HitTestBehavior.opaque,
          onTap: _toggle,
          child: Container(
            // px-4 py-3, rounded-2xl
            padding: const EdgeInsets.symmetric(
              horizontal: NhamSpacing.sp4,
              vertical: NhamSpacing.sp3,
            ),
            decoration: BoxDecoration(
              // open: border #C9A87C + bg white + shadow-sm; closed: #EAE7E0 + cream
              color: _open ? const Color(0xFFFFFFFF) : NhamColors.cream,
              borderRadius: BorderRadius.circular(NhamRadii.containerLg),
              border: Border.all(
                color: _open ? NhamColors.accent : NhamColors.inputBorder,
              ),
              boxShadow: _open ? const [NhamShadows.sm] : null,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    display,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: NhamTextStyles.sansRegular(fontSize: 14).copyWith(
                      color: hasValue ? NhamColors.text : NhamColors.textHelp,
                    ),
                  ),
                ),
                const SizedBox(width: NhamSpacing.sp2),
                RotationTransition(
                  turns: Tween<double>(begin: 0, end: 0.5).animate(_chevron),
                  child: const Icon(
                    Icons.keyboard_arrow_down,
                    size: 16,
                    color: NhamColors.textHelp,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOverlay(BuildContext context) {
    // Tap-outside scrim to dismiss.
    return Stack(
      children: [
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.translucent,
            onTap: _close,
          ),
        ),
        CompositedTransformFollower(
          link: _link,
          showWhenUnlinked: false,
          targetAnchor:
              _flipAbove ? Alignment.topLeft : Alignment.bottomLeft,
          followerAnchor:
              _flipAbove ? Alignment.bottomLeft : Alignment.topLeft,
          offset: Offset(0, _flipAbove ? -8 : 8),
          child: SizedBox(
            width: _triggerWidth,
            child: _DropdownPanel(
              maxHeight: _maxHeight,
              query: _query,
              search: _search,
              selectedValue: widget.value,
              onQueryChange: (v) => setState(() => _query = v),
              onPick: (v) {
                widget.onChange(v);
                _close();
              },
            ),
          ),
        ),
      ],
    );
  }
}

class _DropdownPanel extends StatelessWidget {
  const _DropdownPanel({
    required this.maxHeight,
    required this.query,
    required this.search,
    required this.selectedValue,
    required this.onQueryChange,
    required this.onPick,
  });

  final double maxHeight;
  final String query;
  final TextEditingController search;
  final String? selectedValue;
  final ValueChanged<String> onQueryChange;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    final q = query.toLowerCase();
    final filtered = q.isEmpty
        ? kCountries
        : kCountries
            .where((c) =>
                c.value.toLowerCase().contains(q) ||
                c.vi.toLowerCase().contains(q))
            .toList();

    return Material(
      type: MaterialType.transparency,
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFFFFFFFF),
          borderRadius: BorderRadius.circular(NhamRadii.containerLg), // rounded-2xl
          border: Border.all(color: NhamColors.inputBorder),
          boxShadow: const [
            // shadow-[0_20px_60px_rgba(44,36,22,0.18)]
            BoxShadow(
              color: Color(0x2E2C2416),
              blurRadius: 60,
              offset: Offset(0, 20),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Search header (p-2 + bottom border).
            Container(
              padding: const EdgeInsets.all(NhamSpacing.sp2),
              decoration: const BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: NhamColors.inputBorder),
                ),
              ),
              child: TextField(
                controller: search,
                autofocus: true,
                onChanged: onQueryChange,
                cursorColor: NhamColors.accent,
                style: NhamTextStyles.sansRegular(fontSize: 13)
                    .copyWith(color: NhamColors.text),
                decoration: InputDecoration(
                  isDense: true,
                  filled: true,
                  fillColor: NhamColors.track, // bg-[#F5F4F0]
                  hintText: tr('onboarding.origin.searchCountry'),
                  hintStyle: NhamTextStyles.sansRegular(fontSize: 13)
                      .copyWith(color: NhamColors.textHelp), // #8B8682
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: NhamSpacing.sp3,
                    vertical: NhamSpacing.sp2,
                  ),
                  border: _border(),
                  enabledBorder: _border(),
                  focusedBorder: _border(),
                ),
              ),
            ),
            Flexible(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxHeight: maxHeight),
                child: filtered.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: NhamSpacing.sp3,
                          vertical: NhamSpacing.sp2,
                        ),
                        child: Text(
                          tr('onboarding.origin.noCountries'),
                          textAlign: TextAlign.center,
                          style: NhamTextStyles.sansRegular(fontSize: 13)
                              .copyWith(color: NhamColors.textHelp),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(NhamSpacing.sp1), // p-1
                        shrinkWrap: true,
                        keyboardDismissBehavior:
                            ScrollViewKeyboardDismissBehavior.onDrag,
                        itemCount: filtered.length,
                        itemBuilder: (context, i) {
                          final item = filtered[i];
                          return _OptionRow(
                            country: item,
                            selected: selectedValue == item.value,
                            onTap: () => onPick(item.value),
                          );
                        },
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  OutlineInputBorder _border() => OutlineInputBorder(
        borderRadius: BorderRadius.circular(NhamRadii.md), // rounded-lg
        borderSide: BorderSide.none,
      );
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
    // selected = bg-[#C9A87C]/10 + medium #2C2416; hover/press = bg #F5F4F0.
    final Color fill = widget.selected
        ? NhamColors.accent10
        : (_pressed ? NhamColors.track : Colors.transparent);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: Container(
        decoration: BoxDecoration(
          color: fill,
          borderRadius: BorderRadius.circular(NhamRadii.buttonXl), // rounded-xl
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: NhamSpacing.sp3, // px-3
          vertical: NhamSpacing.sp2_5, // py-2.5
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Flexible(
              child: Text(
                widget.country.value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: (widget.selected
                        ? NhamTextStyles.sansMedium(fontSize: 13)
                        : NhamTextStyles.sansRegular(fontSize: 13))
                    .copyWith(color: NhamColors.text),
              ),
            ),
            const SizedBox(width: NhamSpacing.sp3),
            Text(
              widget.country.vi,
              style: NhamTextStyles.sansRegular(fontSize: 11)
                  .copyWith(color: NhamColors.textHelp), // #8B8682
            ),
          ],
        ),
      ),
    );
  }
}
