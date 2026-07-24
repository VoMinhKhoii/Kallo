import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';

class CustomSelectOption {
  final String value;
  final String label;
  const CustomSelectOption({required this.value, required this.label});
}

/// Mirror of `components/onboarding/screen-body-metrics.tsx` CustomSelect.
///
/// An anchored popover (NOT a centered dialog): portal at the trigger bottom
/// (+6px, flipped above when no room), same width as the trigger, rounded-xl,
/// border #EAE7E0, bg white, py-1.5, shadow [0_8px_30px_rgba(0,0,0,0.08)]. The
/// menu animates initial {opacity:0, y:-5, scale:0.98} → {1,0,1} over 150ms
/// easeOut; the trigger chevron rotates 180° over 300ms.
class CustomSelect extends StatefulWidget {
  const CustomSelect({
    super.key,
    required this.options,
    required this.value,
    required this.onChange,
  });

  final List<CustomSelectOption> options;
  final String value;
  final ValueChanged<String> onChange;

  @override
  State<CustomSelect> createState() => _CustomSelectState();
}

class _CustomSelectState extends State<CustomSelect>
    with TickerProviderStateMixin {
  final OverlayPortalController _portal = OverlayPortalController();
  final LayerLink _link = LayerLink();
  final GlobalKey _triggerKey = GlobalKey();

  late final AnimationController _chevron = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 300),
  );
  late final AnimationController _menu = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 150),
  );

  bool _open = false;
  bool _pressed = false;
  bool _flipAbove = false;
  double _maxHeight = 320;
  double _triggerWidth = 0;

  @override
  void dispose() {
    _chevron.dispose();
    _menu.dispose();
    super.dispose();
  }

  CustomSelectOption? get _selected {
    for (final o in widget.options) {
      if (o.value == widget.value) return o;
    }
    return null;
  }

  void _toggle() {
    if (_open) {
      _close();
    } else {
      _computePlacement();
      setState(() => _open = true);
      _portal.show();
      _chevron.forward();
      _menu.forward(from: 0);
    }
  }

  void _close() {
    _chevron.reverse();
    _portal.hide();
    setState(() => _open = false);
  }

  void _computePlacement() {
    final box = _triggerKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null) return;
    final screenH = MediaQuery.sizeOf(context).height;
    final topLeft = box.localToGlobal(Offset.zero);
    final spaceBelow = screenH - (topLeft.dy + box.size.height);
    final spaceAbove = topLeft.dy;
    _triggerWidth = box.size.width;
    _flipAbove = spaceBelow < 180 && spaceAbove > spaceBelow + 40;
    final avail = (_flipAbove ? spaceAbove : spaceBelow) - 16;
    _maxHeight = avail.clamp(120.0, 320.0);
  }

  @override
  Widget build(BuildContext context) {
    // open: border accent + shadow-sm + ring; idle: #EAE7E0 + hover accent/50.
    final Color borderColor = _open
        ? NhamColors.accent
        : (_pressed ? NhamColors.accent50 : NhamColors.inputBorder);

    return CompositedTransformTarget(
      link: _link,
      child: OverlayPortal(
        controller: _portal,
        overlayChildBuilder: _buildOverlay,
        child: GestureDetector(
          key: _triggerKey,
          behavior: HitTestBehavior.opaque,
          onTapDown: (_) => setState(() => _pressed = true),
          onTapUp: (_) => setState(() => _pressed = false),
          onTapCancel: () => setState(() => _pressed = false),
          onTap: _toggle,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: NhamSpacing.sp3, // px-3
              vertical: NhamSpacing.sp2, // py-2
            ),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFFFF),
              borderRadius: BorderRadius.circular(NhamRadii.md), // rounded-lg
              border: Border.all(
                color: borderColor,
                // open ≈ 1px border + ring/20; approximate with 1.5px.
                width: _open ? 1.5 : 1,
              ),
              boxShadow: _open ? const [NhamShadows.sm] : null,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(right: NhamSpacing.sp2),
                    child: Text(
                      _selected?.label ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: dashBody(),
                    ),
                  ),
                ),
                RotationTransition(
                  turns: Tween<double>(begin: 0, end: 0.5).animate(_chevron),
                  child: const Icon(
                    LucideIcons.chevronDown,
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
          targetAnchor: _flipAbove ? Alignment.topLeft : Alignment.bottomLeft,
          followerAnchor:
              _flipAbove ? Alignment.bottomLeft : Alignment.topLeft,
          offset: Offset(0, _flipAbove ? -6 : 6),
          child: SizedBox(
            width: _triggerWidth,
            child: AnimatedBuilder(
              animation: _menu,
              builder: (context, child) {
                final t = Curves.easeOut.transform(_menu.value);
                return Opacity(
                  opacity: t,
                  child: Transform.translate(
                    offset: Offset(0, -5 * (1 - t)), // y: -5 → 0
                    child: Transform.scale(
                      scale: 0.98 + 0.02 * t, // scale: 0.98 → 1
                      alignment: Alignment.topCenter,
                      child: child,
                    ),
                  ),
                );
              },
              child: _OptionsPanel(
                options: widget.options,
                value: widget.value,
                maxHeight: _maxHeight,
                onPick: (v) {
                  widget.onChange(v);
                  _close();
                },
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _OptionsPanel extends StatelessWidget {
  const _OptionsPanel({
    required this.options,
    required this.value,
    required this.maxHeight,
    required this.onPick,
  });

  final List<CustomSelectOption> options;
  final String value;
  final double maxHeight;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    return Material(
      type: MaterialType.transparency,
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFFFFFFFF),
          borderRadius: BorderRadius.circular(NhamRadii.buttonXl), // rounded-xl
          border: Border.all(color: NhamColors.inputBorder),
          boxShadow: const [
            // shadow-[0_8px_30px_rgb(0,0,0,0.08)]
            BoxShadow(
              color: Color(0x14000000),
              blurRadius: 30,
              offset: Offset(0, 8),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxHeight),
          child: ListView(
            padding: const EdgeInsets.symmetric(vertical: 6), // py-1.5
            shrinkWrap: true,
            children: [
              for (final opt in options)
                _OptionRow(
                  option: opt,
                  selected: value == opt.value,
                  onTap: () => onPick(opt.value),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OptionRow extends StatefulWidget {
  const _OptionRow({
    required this.option,
    required this.selected,
    required this.onTap,
  });

  final CustomSelectOption option;
  final bool selected;
  final VoidCallback onTap;

  @override
  State<_OptionRow> createState() => _OptionRowState();
}

class _OptionRowState extends State<_OptionRow> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: Container(
        color: _pressed ? NhamColors.track : Colors.transparent, // hover #F5F4F0
        padding: const EdgeInsets.symmetric(
          horizontal: NhamSpacing.sp3, // px-3
          vertical: NhamSpacing.sp2_5, // py-2.5
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                widget.option.label,
                style: dashBody(
                  weight: widget.selected ? FontWeight.w500 : FontWeight.w400,
                ),
              ),
            ),
            if (widget.selected)
              const Icon(LucideIcons.check, size: 16, color: NhamColors.text)
            else
              const SizedBox(width: 16, height: 16),
          ],
        ),
      ),
    );
  }
}
