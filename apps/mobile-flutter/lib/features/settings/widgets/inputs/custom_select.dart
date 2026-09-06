import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// A single option for [CustomSelect].
class CustomSelectOption {
  final String value;
  final String label;
  const CustomSelectOption({required this.value, required this.label});
}

/// Port of web `components/settings/custom-select.tsx` — an inline anchored
/// dropdown that opens directly below the trigger (matching its width), with a
/// check on the selected option.
///
/// Trigger: white pill, `inputBorder` 1px border (closed; `accent50` on press).
/// Open: `accent` 1px border + `shadow.sm` + a 1px `accent20` outer ring.
/// Chevron rotates 180° over 300ms on open. The popover sits `mt-1.5` (6px)
/// below the trigger and animates {opacity 0→1, y -5→0, scale 0.98→1} over
/// 150ms easeOut from its top edge. No backdrop dim; tap-outside closes.
class CustomSelect extends StatefulWidget {
  const CustomSelect({
    super.key,
    required this.options,
    required this.value,
    required this.onChange,
    this.placeholder,
  });

  final List<CustomSelectOption> options;
  final String value;
  final ValueChanged<String> onChange;

  /// Muted trigger text shown while [value] matches no option (e.g. a field
  /// that must be genuinely chosen and starts empty).
  final String? placeholder;

  @override
  State<CustomSelect> createState() => _CustomSelectState();
}

class _CustomSelectState extends State<CustomSelect>
    with TickerProviderStateMixin {
  final LayerLink _link = LayerLink();
  final GlobalKey _triggerKey = GlobalKey();
  OverlayEntry? _entry;
  bool _open = false;
  bool _pressed = false;

  late final AnimationController _chevron = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 300),
  );
  late final AnimationController _popover = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 150),
  );

  @override
  void dispose() {
    _removeOverlay();
    _chevron.dispose();
    _popover.dispose();
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
          (_) => _DropdownOverlay(
            link: _link,
            width: width,
            animation: _popover,
            options: widget.options,
            value: widget.value,
            onPick: (v) {
              widget.onChange(v);
              _close();
            },
            onDismiss: _close,
          ),
    );
    Overlay.of(context).insert(_entry!);
    setState(() => _open = true);
    _chevron.forward();
    _popover.forward(from: 0);
  }

  void _close() {
    _chevron.reverse();
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
        widget.options
            .where((o) => o.value == widget.value)
            .map((o) => o.label)
            .firstOrNull;

    final borderColor =
        _open
            ? KalloColors.accent
            : (_pressed ? KalloColors.accent50 : KalloColors.inputBorder);

    return Semantics(
      button: true,
      excludeSemantics: true,
      label: selected ?? widget.placeholder ?? '',
      onTap: _toggle,
      child: CompositedTransformTarget(
        link: _link,
        child: GestureDetector(
          onTap: _toggle,
          onTapDown: (_) => setState(() => _pressed = true),
          onTapUp: (_) => setState(() => _pressed = false),
          onTapCancel: () => setState(() => _pressed = false),
          child: Container(
            key: _triggerKey,
            // Outer ring: `ring-1 ring-accent/20` when open, sitting 1px outside
            // the 1px border at the same `rounded-lg` (8px) radius.
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(KalloRadii.lg + 1),
              border: Border.all(
                color: _open ? KalloColors.accent20 : Colors.transparent,
                width: 1,
              ),
            ),
            child: Container(
              decoration: BoxDecoration(
                color: KalloColors.elev,
                borderRadius: BorderRadius.circular(KalloRadii.lg),
                border: Border.all(color: borderColor, width: 1),
                boxShadow: _open ? const [KalloShadows.sm] : null,
              ),
              padding: const EdgeInsets.symmetric(
                horizontal: KalloSpacing.sp3,
                vertical: KalloSpacing.sp2,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(right: KalloSpacing.sp2),
                      child: Text(
                        selected ?? widget.placeholder ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: dashBody(
                          color: selected != null ? kInk : kInkMuted,
                        ),
                      ),
                    ),
                  ),
                  RotationTransition(
                    turns: Tween<double>(begin: 0, end: 0.5).animate(_chevron),
                    child: const Icon(
                      LucideIcons.chevronDown300,
                      size: 16,
                      color: kInkMuted,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DropdownOverlay extends StatelessWidget {
  const _DropdownOverlay({
    required this.link,
    required this.width,
    required this.animation,
    required this.options,
    required this.value,
    required this.onPick,
    required this.onDismiss,
  });

  final LayerLink link;
  final double width;
  final Animation<double> animation;
  final List<CustomSelectOption> options;
  final String value;
  final ValueChanged<String> onPick;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final curve = CurvedAnimation(parent: animation, curve: Curves.easeOut);
    return Stack(
      children: [
        // Transparent tap-out catcher (no dim, matching the web's
        // click-outside-to-close with no scrim).
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onDismiss,
          ),
        ),
        CompositedTransformFollower(
          link: link,
          showWhenUnlinked: false,
          targetAnchor: Alignment.bottomLeft,
          followerAnchor: Alignment.topLeft,
          offset: const Offset(0, 6), // mt-1.5
          child: Align(
            alignment: Alignment.topLeft,
            child: SizedBox(
              width: width,
              child: AnimatedBuilder(
                animation: curve,
                builder: (context, child) {
                  final t = curve.value;
                  return Opacity(
                    opacity: t,
                    child: Transform.translate(
                      offset: Offset(0, -5 * (1 - t)), // y -5 → 0
                      child: Transform.scale(
                        scale: 0.98 + 0.02 * t, // 0.98 → 1
                        alignment: Alignment.topCenter,
                        child: child,
                      ),
                    ),
                  );
                },
                child: Material(
                  color: Colors.transparent,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 6), // py-1.5
                    decoration: BoxDecoration(
                      color: KalloColors.elev,
                      borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
                      border: Border.all(color: KalloColors.inputBorder),
                      boxShadow: const [
                        // shadow-[0_8px_30px_rgb(0,0,0,0.08)]
                        BoxShadow(
                          color: Color(0x14000000),
                          blurRadius: 30,
                          offset: Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        for (final opt in options)
                          _DropdownRow(
                            option: opt,
                            selected: value == opt.value,
                            onTap: () => onPick(opt.value),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _DropdownRow extends StatefulWidget {
  const _DropdownRow({
    required this.option,
    required this.selected,
    required this.onTap,
  });

  final CustomSelectOption option;
  final bool selected;
  final VoidCallback onTap;

  @override
  State<_DropdownRow> createState() => _DropdownRowState();
}

class _DropdownRowState extends State<_DropdownRow> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: widget.selected,
      excludeSemantics: true,
      label: widget.option.label,
      onTap: widget.onTap,
      child: GestureDetector(
        onTap: widget.onTap,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150), // transition-colors
          color: _pressed ? KalloColors.track : Colors.transparent,
          padding: const EdgeInsets.symmetric(
            horizontal: KalloSpacing.sp3,
            vertical: KalloSpacing.sp2 + 2, // py-2.5 = 10
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  widget.option.label,
                  style: dashBody(
                  ),
                ),
              ),
              if (widget.selected)
                const Icon(
                  LucideIcons.check300,
                  size: 16,
                  color: KalloColors.text,
                )
              else
                const SizedBox(width: 16, height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
