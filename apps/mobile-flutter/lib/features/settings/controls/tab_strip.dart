import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';

/// A single tab descriptor for [TabStrip].
class TabStripItem {
  final String id;
  final String label;
  const TabStripItem({required this.id, required this.label});
}

/// RN port of the web settings `TabsList` — a pill segmented control.
///
/// Container: `inputBorder40` bg, radius 12, 4px inner padding, 4px gap. Active
/// pill: white (`elev`) fill + `shadow.xs`, rounded-md (6). Press: 0.7 opacity.
class TabStrip extends StatelessWidget {
  const TabStrip({
    super.key,
    required this.tabs,
    required this.active,
    required this.onChange,
  });

  final List<TabStripItem> tabs;
  final String active;
  final ValueChanged<String> onChange;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp1),
      decoration: BoxDecoration(
        color: NhamColors.inputBorder40,
        borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
      ),
      child: Row(
        children: [
          for (var i = 0; i < tabs.length; i++) ...[
            if (i > 0) const SizedBox(width: NhamSpacing.sp1),
            Expanded(child: _TabButton(
              tab: tabs[i],
              active: tabs[i].id == active,
              onTap: () {
                HapticFeedback.selectionClick();
                onChange(tabs[i].id);
              },
            )),
          ],
        ],
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({
    required this.tab,
    required this.active,
    required this.onTap,
  });

  final TabStripItem tab;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(
          horizontal: NhamSpacing.sp3,
          vertical: NhamSpacing.sp1 + 2, // py-1.5 = 6
        ),
        decoration: BoxDecoration(
          color: active ? NhamColors.elev : Colors.transparent,
          borderRadius: BorderRadius.circular(NhamRadii.md), // rounded-lg = 8
          boxShadow: active ? const [NhamShadows.sm] : null,
        ),
        child: Text(
          tab.label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.sm).copyWith(
            color: active ? NhamColors.text : NhamColors.textWarm,
          ),
        ),
      ),
    );
  }
}
