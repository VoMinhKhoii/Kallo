/// The pieces the invite sheet's rows are assembled from: the two-line value
/// row and the glyph action that sits at its right edge.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// One identity row (native pass, 2026-08-31): a 12pt muted label over the
/// 14/500 value it names, 64pt tall, with its actions as bare glyphs in 44pt
/// targets at the right.
///
/// The old shape put the label above a track-filled pill and hung bordered
/// 40pt buttons beside it — three nested boxes to show one string. The row
/// anatomy is the app's, so this reads like every other grouped row.
class InviteValueRow extends StatelessWidget {
  const InviteValueRow({
    super.key,
    required this.label,
    required this.value,
    this.muted = false,
    this.actions = const [],
  });

  final String label;
  final String value;

  /// A placeholder value ("Set a display name") reads muted, not ink.
  final bool muted;

  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 60),
      child: Row(
        children: [
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: dashMeta()),
                const SizedBox(height: 1),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: dashBody(
                    color: muted ? kInkMuted : kInk,
                  ),
                ),
              ],
            ),
          ),
          ...actions,
        ],
      ),
    );
  }
}

/// A bare 24pt glyph in a 44pt target — the row's edit / copy / confirm /
/// cancel affordance. Dims and ignores taps when [disabled]; swaps in a
/// spinner while [loading].
class InviteGlyphAction extends StatelessWidget {
  const InviteGlyphAction({
    super.key,
    required this.icon,
    required this.onTap,
    required this.semanticsLabel,
    this.emphasis = false,
    this.loading = false,
    this.disabled = false,
  });

  final IconData icon;
  final VoidCallback onTap;

  /// The confirm glyph in an editor reads ink; everything else stays muted.
  final bool emphasis;

  final bool loading;
  final bool disabled;
  final String semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final inert = loading || disabled;
    return Semantics(
      button: true,
      enabled: !inert,
      label: semanticsLabel,
      child: Opacity(
        opacity: disabled ? 0.55 : 1,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: inert
              ? null
              : () {
                  HapticFeedback.selectionClick();
                  onTap();
                },
          child: SizedBox(
            width: KalloIcons.hit,
            height: KalloIcons.hit,
            child: Center(
              child: loading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: KalloColors.textMuted,
                      ),
                    )
                  : Icon(
                      icon,
                      size: KalloIcons.size,
                      color: emphasis ? kInk : kInkMuted,
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The label above an inline editor — the one place the row's 12pt label has
/// to survive without its value line under it.
class InviteEditorLabel extends StatelessWidget {
  const InviteEditorLabel({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) => Text(label, style: dashMeta());
}
