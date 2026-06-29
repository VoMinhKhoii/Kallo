import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/features/auth/providers/auth_form_controller.dart';

void main() {
  group('kDuplicateEmailMarker', () {
    // Guards the cross-language contract: the SQL hook's message must keep
    // containing the marker this client matches on. Editing the prose without
    // updating the client fails here instead of silently degrading the
    // duplicate-email sign-in to a generic error. Mirrors the web client's
    // guard in app/auth/callback/route.test.ts. Run from the package root, so
    // the monorepo's supabase/ dir is two levels up.
    test('the block-duplicate migration message still contains the marker', () {
      final sql = File(
        '../../supabase/migrations/'
        '20260629120000_block_duplicate_email_signup.sql',
      ).readAsStringSync();
      expect(sql.toLowerCase(), contains(kDuplicateEmailMarker));
    });
  });
}
