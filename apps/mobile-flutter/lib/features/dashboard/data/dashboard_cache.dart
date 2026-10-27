/// The last dashboard answer kept on the device, so a cold launch shows the
/// user's day at once instead of a skeleton that waits on the network (and, a
/// launch after an hour away, on the token refresh first).
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

/// One file per user, holding the bundle for one day and time zone. Read at
/// most once per (user, day, zone) per app session: the first build of
/// [dashboardBundleProvider] shows it while the real fetch runs; every later
/// build (a meal logged, a pull to refresh) fetches, so a write made on this
/// device is never hidden behind an older copy.
///
/// Every disk failure reads as "nothing saved": the cache can only make the
/// first frame faster, never break the screen.
class DashboardCache {
  DashboardCache({Future<Directory> Function()? directory})
    : _directory = directory ?? getApplicationSupportDirectory;

  final Future<Directory> Function() _directory;

  // Session state, for the whole app process (not per instance): the meal and
  // profile write paths that call [forget] have no Riverpod ref to reach one.
  static final Set<String> _served = {};
  static final Set<String> _forgotten = {};

  /// A write this session (a meal, a profile change) made [userId]'s saved day
  /// older than the server's: never show it again until the app restarts. A
  /// read right after the write (the first-run welcome's target) must see the
  /// write, and the saved copy cannot.
  static void forget(String userId) => _forgotten.add(userId);

  @visibleForTesting
  static void resetSession() {
    _served.clear();
    _forgotten.clear();
  }

  /// The saved bundle JSON for [userId] on [date] in zone [tz], the first time
  /// it is asked for this session; null after that, or when none matches.
  Future<Map<String, dynamic>?> takeOnce(
    String userId,
    String date,
    int tz,
  ) async {
    if (_forgotten.contains(userId)) return null;
    if (!_served.add('$userId|$date|$tz')) return null;
    try {
      final file = await _file(userId);
      if (!await file.exists()) return null;
      final saved = jsonDecode(await file.readAsString());
      if (saved is! Map<String, dynamic>) return null;
      if (saved['date'] != date || saved['tz'] != tz) return null;
      final bundle = saved['bundle'];
      return bundle is Map<String, dynamic> ? bundle : null;
    } catch (_) {
      return null;
    }
  }

  /// Replaces [userId]'s saved bundle with this one.
  Future<void> save(
    String userId,
    String date,
    int tz,
    Map<String, dynamic> bundle,
  ) async {
    try {
      final file = await _file(userId);
      await file.parent.create(recursive: true);
      await file.writeAsString(
        jsonEncode({'date': date, 'tz': tz, 'bundle': bundle}),
      );
    } catch (_) {}
  }

  /// Deletes [userId]'s saved bundle (signed out, or another account in).
  Future<void> clear(String userId) async {
    try {
      final file = await _file(userId);
      if (await file.exists()) await file.delete();
    } catch (_) {}
  }

  Future<File> _file(String userId) async {
    final dir = await _directory();
    // The id is a UUID from our auth server; keep the name to safe characters
    // anyway.
    final name = userId.replaceAll(RegExp(r'[^A-Za-z0-9-]'), '_');
    return File('${dir.path}/dashboard-cache/$name.json');
  }
}

final dashboardCacheProvider = Provider<DashboardCache>(
  (ref) => DashboardCache(),
);
