import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../models/social/circle.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_motion.dart';
import '../../../theme/kallo_typography.dart';

/// Per-person initials-disc tints. A person's seed (or handle) picks one, so
/// people are visually distinguishable in a list. Mirrors the web feed's
/// `avatar-tint.ts`.
const List<List<Color>> _discTints = [
  [Color(0x59C9A87C), Color(0x73E8E6DC)],
  [Color(0x66B8A890), Color(0x599C8C78)],
  [Color(0x73CFC6BA), Color(0x59A9A193)],
];

/// Replicates JavaScript's `(hash * 31 + charCodeAt) | 0` signed hash so the
/// tint a person gets matches the web.
@visibleForTesting
int discTintIndex(String? seed, String handle) {
  final key = seed ?? handle;
  var hash = 0;
  for (final code in key.codeUnits) {
    hash = (hash * 31 + code).toSigned(32);
  }
  return hash.abs() % _discTints.length;
}

/// A person's avatar disc: their uploaded photo when set, else a warm
/// per-person initials disc. Mirrors the web `ProfileAvatar` — a photo that
/// fails to load falls back to the initials, so a stale URL never renders
/// broken. Excluded from semantics because every call site places the person's
/// visible name beside the avatar.
///
/// The photo goes through [CachedNetworkImage], not `Image.network`: the same
/// handful of faces repeat down the Circle feed and across re-entries, and the
/// bare widget kept only an in-memory cache at FULL source resolution — every
/// cold start re-downloaded, and a 1024px upload was decoded whole to fill a
/// 24pt disc. `memCacheWidth` decodes at the disc's device-pixel size, and the
/// disk cache survives the app. The initials disc is both placeholder and
/// error widget, so a slow or dead URL degrades to the same thing.
class ProfileAvatarDisc extends StatelessWidget {
  const ProfileAvatarDisc({
    required this.profile,
    this.size = 24,
    this.fallback,
    super.key,
  });

  final CircleProfile profile;
  final double size;

  /// Drawn instead of the initials disc while the photo loads and if it never
  /// arrives. Callers that own a better glyph pass it here: the portion pin's
  /// seat 0 is a localised "You", and [CircleProfile.initial] would quietly
  /// replace it with the first letter of their name for as long as the photo
  /// is in flight — or forever, on a stale URL.
  final Widget? fallback;

  @override
  Widget build(BuildContext context) {
    final placeholder =
        fallback ??
        _InitialsDisc(
          initial: profile.initial,
          tintIndex: discTintIndex(profile.avatarSeed, profile.handle),
          size: size,
        );
    final url = profile.avatarUrl?.trim();
    return ExcludeSemantics(
      child: ClipOval(
        child: SizedBox.square(
          dimension: size,
          child: url == null || url.isEmpty
              ? placeholder
              : CachedNetworkImage(
                  imageUrl: url,
                  fit: BoxFit.cover,
                  memCacheWidth:
                      (size * MediaQuery.devicePixelRatioOf(context)).round(),
                  fadeInDuration: KalloMotion.quick,
                  placeholder: (_, _) => placeholder,
                  errorWidget: (_, _, _) => placeholder,
                ),
        ),
      ),
    );
  }
}

class _InitialsDisc extends StatelessWidget {
  const _InitialsDisc({
    required this.initial,
    required this.tintIndex,
    required this.size,
  });

  final String initial;
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
      initial,
      style: KalloTextStyles.sansMedium(
        fontSize: size <= 28 ? 10 : 12,
      ).copyWith(color: kInk),
    ),
  );
}
