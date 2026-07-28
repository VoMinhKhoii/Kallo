export type ContainerVessel = {
  family: 'bowl' | 'plate' | 'cup';
  tier: 1 | 2 | 3 | 4;
  dishClass: 'soup' | 'solid' | 'airy' | 'drink';
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
