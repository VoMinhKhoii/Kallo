import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/nham_text.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import 'entrances.dart';

// Hardcoded Vietnamese suggestions (matches web — these are NOT localized).
const _suggestions = ['2 mực kho + cơm', 'Phở bò tái', 'Bún chả Hà Nội'];

/// The "what did you eat?" empty feed. Staggered entrances mirror the web:
/// icon scale (delay 50), title (100), subtitle (200), chips (300).
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.onSuggestion});

  final ValueChanged<String> onSuggestion;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp10), // py-10
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Icon tile — w-10 h-10 rounded-xl bg-border/30, UtensilsCrossed 20px.
          ZoomIn(
            delay: const Duration(milliseconds: 50),
            child: Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: NhamColors.borderFaint, // border @ 30%
                borderRadius: BorderRadius.circular(NhamRadii.xl), // rounded-xl
              ),
              child: const Icon(
                LucideIcons.utensilsCrossed, // lucide UtensilsCrossed → LucideIcons.utensilsCrossed
                size: 20,
                color: NhamColors.textMuted,
              ),
            ),
          ),
          const SizedBox(height: NhamSpacing.sp4), // gap-4
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              FadeInDown(
                delay: const Duration(milliseconds: 100),
                child: NhamText(
                  'logging.emptyState.title'.tr(),
                  variant: NhamTextVariant.h4,
                  textAlign: TextAlign.center,
                  style: const TextStyle(letterSpacing: NhamTracking.tight),
                ),
              ),
              const SizedBox(height: 6), // gap-1.5
              FadeInDown(
                delay: const Duration(milliseconds: 200),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 280),
                  child: NhamText(
                    'logging.emptyState.subtitle'.tr(),
                    variant: NhamTextVariant.small,
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: NhamSpacing.sp4), // gap-4
          FadeInDown(
            delay: const Duration(milliseconds: 300),
            child: Wrap(
              alignment: WrapAlignment.center,
              spacing: 6, // gap-1.5
              runSpacing: 6,
              children: [
                for (final s in _suggestions)
                  _SuggestionChip(label: s, onTap: () => onSuggestion(s)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A suggestion pill: border/60 rounded-full px-3 py-1 bg-white/80; pressed →
/// accent/50 border + border/15 fill (web `hover:` touch affordance).
class _SuggestionChip extends StatefulWidget {
  const _SuggestionChip({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  State<_SuggestionChip> createState() => _SuggestionChipState();
}

class _SuggestionChipState extends State<_SuggestionChip> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 4), // px-3 py-1
        decoration: BoxDecoration(
          // Pressed fill is bg-nham-border/15 (border @15%), not accent.
          color: _pressed
              ? const Color(0x26E8D5B5)
              : NhamColors.elevTranslucent,
          borderRadius: BorderRadius.circular(NhamRadii.pill),
          border: Border.all(
            color: _pressed ? NhamColors.accent50 : NhamColors.borderSoft,
          ),
        ),
        child: NhamText(widget.label, variant: NhamTextVariant.chipText),
      ),
    );
  }
}
