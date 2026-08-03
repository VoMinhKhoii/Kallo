import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/relog.dart';
import '../../data/relog_providers.dart';
import 'relog_picker_popup.dart';

/// The `/` picker plus its search, kept in its own consumer so a keystroke
/// re-renders the popup rather than the whole feed.
///
/// It holds the last resolved response and keeps showing it while the next
/// query is in flight — the web's `keepPreviousData`. Without it every new
/// query would collapse the list to a one-line "Searching…", and because the
/// composer dock measures itself, that collapse would jump the composer up and
/// down under the user's thumb between keystrokes.
class RelogPickerSection extends ConsumerStatefulWidget {
  const RelogPickerSection({
    super.key,
    required this.query,
    required this.onSelect,
    required this.onDismiss,
  });

  /// The debounced token text. Empty means "show my staples", which is a real
  /// result set server-side, not a blank state.
  final String query;
  final ValueChanged<RelogCandidate> onSelect;
  final VoidCallback onDismiss;

  @override
  ConsumerState<RelogPickerSection> createState() => _RelogPickerSectionState();
}

class _RelogPickerSectionState extends ConsumerState<RelogPickerSection> {
  RelogCandidatesResponse? _lastResolved;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(relogCandidatesProvider(widget.query));
    final resolved = async.valueOrNull;
    if (resolved != null) _lastResolved = resolved;

    // An error is not an empty history: fall back to whatever was last shown,
    // and when there is nothing to fall back to, say the search FAILED rather
    // than letting the empty copy tell someone with a year of meals that they
    // have never logged anything.
    final candidates =
        resolved ?? _lastResolved ?? const RelogCandidatesResponse();

    return RelogPickerPopup(
      candidates: candidates,
      isLoading: async.isLoading,
      hasError: async.hasError,
      onRetry: () => ref.invalidate(relogCandidatesProvider(widget.query)),
      query: widget.query,
      onSelect: widget.onSelect,
      onDismiss: widget.onDismiss,
    );
  }
}
