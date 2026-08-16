import 'package:flutter/material.dart';

import '../../../shared/widgets/kallo_mark.dart';
import '../../../shared/widgets/kallo_wordmark.dart';
import '../../../theme/kallo_colors.dart';

/// App icon tile + wordmark — the standard mobile auth hero. The tile is
/// decorative next to the wordmark, so it's excluded from semantics to avoid
/// announcing "Kallo" twice.
class AuthBrandHero extends StatelessWidget {
  const AuthBrandHero({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ExcludeSemantics(
          child: Container(
            width: 64,
            height: 64,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: KalloColors.text,
              borderRadius: BorderRadius.circular(16),
            ),
            child: const KalloMark(height: 32, color: KalloColors.surface),
          ),
        ),
        const SizedBox(height: 16),
        const KalloWordmark(height: 22),
      ],
    );
  }
}
