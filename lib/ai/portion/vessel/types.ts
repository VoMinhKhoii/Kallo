export type ContainerVessel = {
  family: 'bowl' | 'plate' | 'cup';
  tier: 1 | 2 | 3 | 4;
  dishClass: 'soup' | 'solid' | 'airy' | 'drink';
  /** Plain rice only: grams in one small bowl — the user's country's bowl of
   *  rice — shown for tier 1 instead of the bowl's geometry. Older clients
   *  ignore it and keep the geometry. */
  smallBowlG?: number;
};

export type PieceVessel = {
  family: 'piece';
  tier: 1 | 2 | 3 | 4 | 5;
  count: number;
  kind: 'fish' | 'meat' | 'poultry';
};

export type ClientVessel = ContainerVessel | PieceVessel;

export type PipelineVessel =
  | (ContainerVessel & {
      provenance: 'vessel_prior';
    })
  | (PieceVessel & {
      provenance: 'piece_prior';
    });
