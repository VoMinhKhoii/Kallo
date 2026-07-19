import 'package:flutter/material.dart';

import '../../features/circle/widgets/circle_avatar.dart';
import '../../models/circle.dart';

/// A person's avatar disc: their uploaded photo when set, else the warm
/// initials disc. Mirrors the web `ProfileAvatar` — a photo that fails to
/// load falls back to the initials, so a stale URL never renders broken.
class ProfileAvatarDisc extends StatelessWidget {
  const ProfileAvatarDisc({
    required this.profile,
    this.size = 24,
    super.key,
  });

  final CircleProfile profile;
  final double size;

  @override
  Widget build(BuildContext context) {
    final url = profile.avatarUrl;
    final fallback = CircleInitialsAvatar(initial: profile.initial, size: size);
    if (url == null || url.isEmpty) return fallback;

    return ClipOval(
      child: Image.network(
        url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => fallback,
        loadingBuilder: (context, child, progress) =>
            progress == null ? child : fallback,
      ),
    );
  }
}
