import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/logic/relog/pure_relog_staging.dart';

void main() {
  late RelogAttemptLedger ledger;

  setUp(() => ledger = RelogAttemptLedger());

  test('mints an id the first time a selection is staged', () {
    final id = ledger.idFor({'stage-1'});
    expect(id, isNotEmpty);
  });

  test('a resubmit of the same picks reuses its id', () {
    // The whole point: a stage that commits but loses its response leaves the
    // composer untouched, so the user resubmits. The server upserts on
    // (user_id, attempt_id) — same id, same row, one review card.
    final first = ledger.idFor({'stage-1', 'stage-2'});
    final second = ledger.idFor({'stage-1', 'stage-2'});
    expect(second, first);
  });

  test(
    'the selection is a set, not a sequence — order cannot mint a new id',
    () {
      // The picks come out of the composer in composer order, which changes when
      // a pick is inserted before another. Keying on the order would hand the
      // same meal a second attempt id and stage it twice.
      final forward = ledger.idFor({'a', 'b', 'c'});
      final shuffled = ledger.idFor({'c', 'a', 'b'});
      expect(shuffled, forward);
    },
  );

  test('changing the picks mints a new id — that is a new meal', () {
    final original = ledger.idFor({'stage-1'});
    final widened = ledger.idFor({'stage-1', 'stage-2'});
    expect(widened, isNot(original));
  });

  test('a subset is a different selection, not the same one', () {
    final pair = ledger.idFor({'stage-1', 'stage-2'});
    final single = ledger.idFor({'stage-1'});
    expect(single, isNot(pair));
  });

  test('releasing a landed stage frees the selection for a new meal', () {
    // Once the stage is known to have landed the id has done its job: logging
    // the very same dishes again is a SECOND meal and must not overwrite the
    // first one's pending row.
    final first = ledger.idFor({'stage-1'});
    ledger.release({'stage-1'});
    expect(ledger.idFor({'stage-1'}), isNot(first));
  });

  test('releasing one selection leaves another selection alone', () {
    final kept = ledger.idFor({'stage-1'});
    ledger.idFor({'stage-2'});
    ledger.release({'stage-2'});
    expect(ledger.idFor({'stage-1'}), kept);
  });

  test('releasing a selection that was never staged is a no-op', () {
    final kept = ledger.idFor({'stage-1'});
    ledger.release({'stage-9'});
    expect(ledger.idFor({'stage-1'}), kept);
  });

  test('two selections in flight at once keep separate ids', () {
    final a = ledger.idFor({'stage-1'});
    final b = ledger.idFor({'stage-2'});
    expect(a, isNot(b));
    expect(ledger.idFor({'stage-1'}), a);
    expect(ledger.idFor({'stage-2'}), b);
  });
}
