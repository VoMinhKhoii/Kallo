import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_typography.dart';

const List<List<Color>> _discTints = [
  [Color(0x59C9A87C), Color(0x73E8D5B5)],
  [Color(0x66B8A890), Color(0x599C8C78)],
  [Color(0x73CFC6BA), Color(0x59A9A193)],
];

/// Replicates JavaScript's `(hash * 31 + charCodeAt) | 0` signed hash.
@visibleForTesting
int discTintIndex(String? seed, String handle) {
  final key = seed ?? handle;
  var hash = 0;
  for (final code in key.codeUnits) {
    hash = (hash * 31 + code).toSigned(32);
  }
  return hash.abs() % _discTints.length;
}

class ProfileAvatar extends StatelessWidget {
  const ProfileAvatar({
    required this.label,
    required this.handle,
    this.avatarUrl,
    this.avatarSeed,
    this.size = 36,
    super.key,
  });

  final String label;
  final String handle;
  final String? avatarUrl;
  final String? avatarSeed;
  final double size;

  @override
  Widget build(BuildContext context) {
    final fallback = _InitialsDisc(
      label: label,
      tintIndex: discTintIndex(avatarSeed, handle),
      size: size,
    );
    final url = avatarUrl?.trim();
    // Every current call site places the person's visible name beside the
    // avatar, so announcing the image repeats the same identity.
    return ExcludeSemantics(
      child: ClipOval(
        child: SizedBox.square(
          dimension: size,
          child:
              url == null || url.isEmpty
                  ? fallback
                  : Image.network(
                    url,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => fallback,
                  ),
        ),
      ),
    );
  }
}

class _InitialsDisc extends StatelessWidget {
  const _InitialsDisc({
    required this.label,
    required this.tintIndex,
    required this.size,
  });

  final String label;
  final int tintIndex;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
    alignment: Alignment.center,
    decoration: BoxDecoration(
      gradient: LinearGradient(colors: _discTints[tintIndex]),
      shape: BoxShape.circle,
    ),
    child: Text(
      label.isEmpty ? '·' : label.characters.first.toUpperCase(),
      style: TextStyle(
        fontFamily: NhamTextStyles.sansFamily,
        fontSize: size <= 28 ? 10 : 12,
        fontWeight: FontWeight.w500,
        color: kInk,
      ),
    ),
  );
}
