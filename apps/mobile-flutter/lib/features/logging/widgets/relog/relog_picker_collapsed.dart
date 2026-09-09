import 'package:flutter/material.dart';

/// The collapse branch, a StatefulWidget because it has a SIDE EFFECT.
/// Rendering nothing is not closing: the query stayed live, so every keystroke
/// still ran a search whose rows could never be seen. It dismisses instead —
/// ONCE, from [initState] (a StatelessWidget's build may run several times in a
/// frame) and post-frame, because this runs during layout. `dismiss` remembers
/// the token, so typing on stays closed and a fresh `/` re-opens.
class RelogPickerCollapsed extends StatefulWidget {
  const RelogPickerCollapsed({super.key, required this.onDismiss});

  final VoidCallback onDismiss;

  @override
  State<RelogPickerCollapsed> createState() => _RelogPickerCollapsedState();
}

class _RelogPickerCollapsedState extends State<RelogPickerCollapsed> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onDismiss();
    });
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
