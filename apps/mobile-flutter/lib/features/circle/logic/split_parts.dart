/// Split parts — the arithmetic behind the portion battery.
///
/// A shared dish is [kTotalParts] units of 5% each and every participant holds
/// a contiguous run of them. Parts are INTEGERS end to end: the control moves
/// whole units, the wire carries whole units, and the server asserts they sum
/// to exactly [kTotalParts]. That is one equality check instead of chasing
/// "do these fractions add to 0.9999?".
///
/// The twin of this file on the server is `lib/domain/social/splits/parts.ts`.
/// The two must agree on all three constants or a share built here will be
/// refused there.
library;

/// The dish, in units of 5%.
const int kTotalParts = 20;

/// Nobody may hold less than this. 2 parts = 10%, which is also the narrowest
/// run the meter can draw a face over without the faces colliding.
const int kMinParts = 2;

/// Seats in the palette: you plus five friends.
const int kMaxParticipants = 6;

/// An even split across [participants], as whole parts.
///
/// [kTotalParts] is not divisible by 3 or 6, so the remainder goes to the
/// earliest seats — an even three-way split is 7/7/6, which the meter shows
/// honestly as 35/35/30 rather than pretending to be thirds.
List<int> evenParts(int participants) {
  assert(
    participants >= 2 && participants <= kMaxParticipants,
    'participants must be 2..$kMaxParticipants',
  );
  final base = kTotalParts ~/ participants;
  var remainder = kTotalParts - base * participants;
  return List<int>.generate(participants, (_) {
    final extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return base + extra;
  });
}

/// Where the notch after [boundary] may actually land.
///
/// [boundary] is the index of the run on the LEFT of the notch, so notch `i`
/// sits between runs `i` and `i + 1`. [desiredLeftEnd] is the part index the
/// finger is asking for, counted from the start of the bar.
///
/// Two clauses, and together they make overlap impossible by construction:
///   1. A notch never passes its neighbours — crossing one would mean somebody
///      owns a negative run.
///   2. A notch stops [kMinParts] short of each neighbour, so no run is ever
///      narrower than the pin sitting on it.
///
/// Returns the clamped left-end, in parts from the start of the bar.
int clampNotch({
  required List<int> parts,
  required int boundary,
  required int desiredLeftEnd,
}) {
  assert(boundary >= 0 && boundary < parts.length - 1, 'boundary out of range');
  // Everything left of this notch, excluding the run it bounds.
  var before = 0;
  for (var i = 0; i < boundary; i++) {
    before += parts[i];
  }
  // The left run may not shrink past the floor…
  final lowest = before + kMinParts;
  // …and may not eat the right run past ITS floor.
  final pairTotal = parts[boundary] + parts[boundary + 1];
  final highest = before + pairTotal - kMinParts;
  return desiredLeftEnd.clamp(lowest, highest);
}

/// Apply a clamped notch drag, returning the new run list.
///
/// Only the two runs the notch sits between change; everyone else is untouched,
/// which is what keeps a drag from quietly restating somebody else's share.
List<int> partsAfterDrag({
  required List<int> parts,
  required int boundary,
  required int desiredLeftEnd,
}) {
  final leftEnd = clampNotch(
    parts: parts,
    boundary: boundary,
    desiredLeftEnd: desiredLeftEnd,
  );
  var before = 0;
  for (var i = 0; i < boundary; i++) {
    before += parts[i];
  }
  final pairTotal = parts[boundary] + parts[boundary + 1];
  final next = List<int>.of(parts);
  next[boundary] = leftEnd - before;
  next[boundary + 1] = pairTotal - next[boundary];
  return next;
}

/// Remove the participant at [index], returning their parts to the table.
///
/// The freed parts go to the neighbours rather than being redistributed
/// evenly: a removal should disturb the shares people already set as little as
/// possible. Any rounding remainder lands on the earliest seat, so the result
/// still sums to [kTotalParts] exactly.
List<int> partsAfterRemoval(List<int> parts, int index) {
  assert(index >= 0 && index < parts.length, 'index out of range');
  assert(parts.length > 2, 'a split needs at least two people');
  final freed = parts[index];
  final next = List<int>.of(parts)..removeAt(index);
  final share = freed ~/ next.length;
  var remainder = freed - share * next.length;
  for (var i = 0; i < next.length; i++) {
    final extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    next[i] += share + extra;
  }
  return next;
}

/// Parts for a party of [participants] after someone joins, preserving the
/// existing runs as far as the floor allows.
///
/// The newcomer is seated last and takes [kMinParts] from whoever can most
/// afford it — the largest run — so adding a person never silently resets a
/// split that was already set by hand.
List<int> partsAfterAdd(List<int> parts) {
  assert(
    parts.length < kMaxParticipants,
    'the palette seats $kMaxParticipants',
  );
  final next = List<int>.of(parts);
  var owed = kMinParts;
  while (owed > 0) {
    var largest = 0;
    for (var i = 1; i < next.length; i++) {
      if (next[i] > next[largest]) largest = i;
    }
    // Every existing run is already at the floor: the table is full in
    // practice, and the caller should have refused before getting here.
    if (next[largest] <= kMinParts) break;
    next[largest] -= 1;
    owed -= 1;
  }
  next.add(kMinParts - owed);
  return next;
}
