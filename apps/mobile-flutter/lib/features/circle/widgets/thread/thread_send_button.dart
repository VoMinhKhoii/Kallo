import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// The reply dock's send affordance: nothing at all until there is a draft.
///
/// Split out of `thread_composer.dart` for the file's 200-line budget, and
/// because it is the one part of the dock that redraws as the user types: it
/// listens to the controller ITSELF rather than making the composer rebuild
/// the field, its decoration and the dock's fill on every keystroke.
class ThreadSendButton extends StatelessWidget {
  const ThreadSendButton({
    required this.controller,
    required this.submitting,
    required this.onSubmit,
    super.key,
  });

  final TextEditingController controller;

  /// Dims the label and swallows taps while a reply is in flight.
  final bool submitting;

  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder:
          (context, value, _) =>
              value.text.trim().isEmpty
                  ? const SizedBox.shrink()
                  : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const SizedBox(width: KalloSpacing.sp2),
                      Semantics(
                        button: true,
                        enabled: !submitting,
                        label: tr('groups.feed.reply'),
                        excludeSemantics: true,
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: submitting ? null : onSubmit,
                          child: Container(
                            // A TIGHT height, not a minHeight: the dock is laid out
                            // in the page's overlay Stack, where the slot is loose
                            // and `alignment` makes a min-constrained box take every
                            // point offered. The Row's cross axis would become the
                            // whole body and the dock's opaque fill would cover every
                            // reply the moment a draft existed.
                            height: KalloIcons.hit,
                            constraints: const BoxConstraints(
                              minWidth: KalloIcons.hit,
                            ),
                            alignment: Alignment.center,
                            child: Opacity(
                              opacity: submitting ? 0.5 : 1,
                              child: Text(
                                tr('groups.feed.reply'),
                                style: dashBody(),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
    );
  }
}
