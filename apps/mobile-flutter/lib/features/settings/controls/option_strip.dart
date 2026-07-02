import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';

/// A single option for [OptionStrip], with an optional hint sub-label.
class OptionStripItem {
  final String value;
  final String label;
  final String? hint;
  const OptionStripItem({required this.value, required this.label, this.hint});
}

/// RN port of web `components/settings/option-strip.tsx` — segmented control
/// with equal-width buttons and an optional hint sub-label.
///
/// Container: `track` bg, radius 12, 4px inner padding. Active button: white
/// (`elev`) fill + `shadow.xs`, rounded-md (6). Press: 0.85 opacity.
class OptionStrip extends StatelessWidget {
  const OptionStrip({
    super.key,
    required this.options,
    required this.value,
    required this.onChange,
  });

  final List<OptionStripItem> options;
  final String value;
  final ValueChanged<String> onChange;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp1),
      decoration: BoxDecoration(
        color: NhamColors.track,
        borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final opt in options)
              Expanded(
                child: _OptionButton(
                  option: opt,
                  active: value == opt.value,
                  onTap: () => onChange(opt.value),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _OptionButton extends StatefulWidget {
  const _OptionButton({
    required this.option,
    required this.active,
    required this.onTap,
  });

  final OptionStripItem option;
  final bool active;
  final VoidCallback onTap;

  @override
  State<_OptionButton> createState() => _OptionButtonState();
}

class _OptionButtonState extends State<_OptionButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    // Inactive `hover:text-[#2C2416]` — text darkens to `kInk` on press.
    final color = widget.active || _pressed ? kInk : kInkMuted;
    final label =
        widget.option.hint == null
            ? widget.option.label
            : '${widget.option.label}, ${widget.option.hint}';
    return Semantics(
      button: true,
      selected: widget.active,
      excludeSemantics: true,
      label: label,
      onTap: widget.onTap,
      child: GestureDetector(
        onTap: widget.onTap,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150), // transition-all
          alignment: Alignment.center,
          // py-2
          padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp2),
          decoration: BoxDecoration(
            color: widget.active ? NhamColors.elev : Colors.transparent,
            borderRadius: BorderRadius.circular(NhamRadii.md), // rounded-lg = 8
            boxShadow: widget.active ? const [NhamShadows.sm] : null,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                widget.option.label,
                textAlign: TextAlign.center,
                style: dashBody(weight: FontWeight.w500, color: color),
              ),
              if (widget.option.hint != null)
                Padding(
                  padding: const EdgeInsets.only(top: 2), // mt-0.5
                  child: Text(
                    widget.option.hint!,
                    textAlign: TextAlign.center,
                    style: dashMeta(color: color.withValues(alpha: 0.7)),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
