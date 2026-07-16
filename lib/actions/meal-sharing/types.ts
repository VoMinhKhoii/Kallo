export interface MealShareInvite {
  id: string;
  mode: 'copy' | 'split';
  /** Fraction of the original the recipient gets — for the "½ portion" label. */
  portionFactor: number;
  createdAt: string;
  from: {
    userId: string;
    handle: string;
    displayName: string | null;
    avatarSeed: string | null;
  };
  /** The portion the recipient will receive (already scaled for a split). */
  meal: {
    rawInput: string;
    caloriesKcal: number | null;
    proteinG: number | null;
    carbohydrateG: number | null;
    fatG: number | null;
  };
}
