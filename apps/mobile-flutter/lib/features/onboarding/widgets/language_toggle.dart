import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';

/// RN port of `components/onboarding/wizard/language-toggle.tsx`.
///
/// Web shows GB/VN SVG flags (`country-flag-icons`); on mobile we use the
/// regional-indicator flag emoji (🇬🇧 English, 🇻🇳 Tiếng Việt), which iOS/Android
/// render natively. lucide `Check` → [Icons.check]. Picking a language switches
/// the app locale live (see `ScreenOrigin`).
class LanguageToggle extends StatelessWidget {
  const LanguageToggle({
    super.key,
    required this.value,
    required this.onChange,
  });

  final String value; // 'en' | 'vi'
  final ValueChanged<String> onChange;

  static const List<({String code, String label, String flag})> _languages = [
    (code: 'en', label: 'English', flag: '🇬🇧'),
    (code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳'),
  ];

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < _languages.length; i++) ...[
          if (i > 0) const SizedBox(width: NhamSpacing.sp3),
          Expanded(
            child: _LangButton(
              label: _languages[i].label,
              flag: _languages[i].flag,
              selected: value == _languages[i].code,
              onTap: () => onChange(_languages[i].code),
            ),
          ),
        ],
      ],
    );
  }
}

class _LangButton extends StatefulWidget {
  const _LangButton({
    required this.label,
    required this.flag,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final String flag;
  final bool selected;
  final VoidCallback onTap;

  @override
  State<_LangButton> createState() => _LangButtonState();
}

class _LangButtonState extends State<_LangButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    // Unselected: hover:border-[#C9A87C]/50 (border lightens toward accent).
    final borderColor = widget.selected
        ? NhamColors.accent
        : (_pressed ? NhamColors.accent50 : NhamColors.inputBorder);
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedContainer(
        // transition-colors ~150ms ease.
        duration: const Duration(milliseconds: 150),
        curve: const Cubic(0.25, 0.1, 0.25, 1),
        padding: const EdgeInsets.symmetric(
          horizontal: NhamSpacing.sp4,
          vertical: NhamSpacing.sp3,
        ),
        decoration: BoxDecoration(
          color: widget.selected ? NhamColors.accent10 : NhamColors.cream,
          borderRadius: BorderRadius.circular(NhamRadii.containerLg),
          border: Border.all(color: borderColor),
        ),
        child: Row(
          children: [
            // h-5 w-7 rounded flag on web → regional-indicator emoji here.
            Text(widget.flag, style: const TextStyle(fontSize: 20)),
            const SizedBox(width: NhamSpacing.sp3),
            Expanded(
              child: Text(
                widget.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: NhamTextStyles.sansMedium(fontSize: 14)
                    .copyWith(color: NhamColors.text),
              ),
            ),
            if (widget.selected) ...[
              const SizedBox(width: NhamSpacing.sp3),
              const Icon(Icons.check, size: 16, color: NhamColors.accent),
            ],
          ],
        ),
      ),
    );
  }
}
