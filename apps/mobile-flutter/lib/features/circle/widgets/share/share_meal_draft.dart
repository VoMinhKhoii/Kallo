import '../../../../models/social/circle.dart';
import '../../logic/split_parts.dart';

/// The share being composed: who is at the table, how the dish divides, and
/// which tab is showing.
///
/// Lifted out of the sheet widget because these three move together and the
/// rules between them are worth reading on their own — a seat added or removed
/// has to rebalance the parts, and a mode switch must not disturb either.
class ShareMealDraft {
  ShareMealDraft();

  /// 'whole' — everyone logs a full serving. 'split' — one dish, divided.
  String mode = 'whole';

  /// Friends in the order they were added: the seat COLOUR is positional, so
  /// it has to stay stable while the table stands and close up when someone
  /// leaves.
  final List<CircleProfile> seated = [];

  /// Parts per seat, index 0 being mine. Always sums to [kTotalParts].
  List<int> parts = evenParts(2);

  bool get isSplit => mode == 'split';
  bool get isEmpty => seated.isEmpty;
  bool get isFull => seated.length + 1 >= kMaxParticipants;

  /// My own run, in parts. A whole-portion share keeps the entire dish.
  int get keptParts => isSplit && seated.isNotEmpty ? parts.first : kTotalParts;

  void add(CircleProfile profile) {
    if (isFull) return;
    seated.add(profile);
    // The first friend starts even; later ones take their floor from whoever
    // can most afford it, so adding someone never resets a hand-set split.
    parts = seated.length == 1 ? evenParts(2) : partsAfterAdd(parts);
  }

  /// [seat] is an index into the METER, where 0 is me — so a friend is
  /// `seat - 1`. Seat 0 carries no remove badge; you cannot remove yourself.
  void removeSeat(int seat) {
    seated.removeAt(seat - 1);
    parts = seated.isEmpty ? evenParts(2) : partsAfterRemoval(parts, seat);
  }

  void splitEvenly() => parts = evenParts(seated.length + 1);

  /// One entry per recipient, for the wire.
  List<Map<String, Object>> splitsPayload() => [
        for (var i = 0; i < seated.length; i++)
          {'userId': seated[i].userId, 'parts': parts[i + 1]},
      ];
}
