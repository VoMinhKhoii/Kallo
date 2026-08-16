import 'package:flutter/material.dart';

import '../../theme/calm_tokens.dart';
import '../../theme/kallo_colors.dart';
import '../../theme/kallo_typography.dart';

/// The app's canonical empty state: a centred mark / title / description column
/// with one action beneath it. Warm and quiet — a blank page, not a loud
/// dashboard placeholder. Use it wherever a list, range or feed comes back with
/// nothing, and pass a [mark] and [action] appropriate to that surface.
///
/// Twin of the web `components/ui/empty-state.tsx` (keep in sync).
class KalloEmptyState extends StatelessWidget {
  const KalloEmptyState({
    super.key,
    required this.title,
    required this.description,
    this.mark,
    this.action,
    this.minHeight = 288,
  });

  /// A single thin line glyph above the title.
  final Widget? mark;
  final String title;

  /// One quiet supporting line — keep it to a sentence.
  final String description;

  /// The one way forward. Optional: some surfaces have nothing to offer.
  final Widget? action;

  /// The block it centres itself inside. Its OWN space — not the whole page,
  /// which would drift with however much happens to sit above and below it.
  final double minHeight;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: BoxConstraints(minHeight: minHeight),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (mark != null) ...[
            mark!,
            const SizedBox(height: 24),
          ],
          Text(
            title,
            textAlign: TextAlign.center,
            style: KalloTextStyles.serifMedium(fontSize: 24).copyWith(
              height: 30 / 24,
              letterSpacing: -0.36,
              color: KalloColors.text,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            description,
            textAlign: TextAlign.center,
            style: dashBody(color: kInkMuted).copyWith(height: 28 / 14),
          ),
          if (action != null) ...[
            const SizedBox(height: 24),
            action!,
          ],
        ],
      ),
    );
  }
}

/// The pill action the empty state pairs with: ink fill, cream label.
class KalloEmptyStateAction extends StatefulWidget {
  const KalloEmptyStateAction({
    super.key,
    required this.label,
    required this.onTap,
  });

  final String label;
  final VoidCallback onTap;

  @override
  State<KalloEmptyStateAction> createState() => _NhamEmptyStateActionState();
}

class _NhamEmptyStateActionState extends State<KalloEmptyStateAction> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: Opacity(
        opacity: _pressed ? 0.9 : 1,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          decoration: BoxDecoration(
            color: KalloColors.text,
            borderRadius: BorderRadius.circular(9999),
          ),
          child: Text(
            widget.label,
            style: dashBody(
              weight: FontWeight.w500,
              color: KalloColors.surface,
            ),
          ),
        ),
      ),
    );
  }
}
