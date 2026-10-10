/**
 * The comparison key for dish and ingredient names that one stage wrote and
 * another reads back (Call 1 → Call 2 → pairing and streaming).
 *
 * NFC first: the same Vietnamese word can arrive composed or decomposed
 * ("Gà" as one code point or as "G" + "a" + a combining grave accent), and
 * the two must compare equal. Then trim and Vietnamese-aware lowercasing,
 * because Call 2 echoes names with its own casing.
 */
export function nameKey(name: string): string {
  return name.normalize('NFC').trim().toLocaleLowerCase('vi-VN');
}
