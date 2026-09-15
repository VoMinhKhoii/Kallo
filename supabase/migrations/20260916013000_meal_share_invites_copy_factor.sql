-- meal_share_invites.copy_factor
--
-- What accept must scale the SOURCE meal by for this recipient. The sender's
-- meal is already scaled down to their own run by the time an invite exists,
-- so this is a ratio between two runs rather than a fraction of the dish.
--
-- DEFAULT 1 is compatibility, not a placeholder: an even split produces a
-- factor of exactly 1, which is the verbatim copy the shipped accept path
-- already performs. Every existing row is therefore correct as-is and no
-- backfill is required.
ALTER TABLE meal_share_invites
  ADD COLUMN copy_factor numeric NOT NULL DEFAULT 1;

-- A factor of zero or below is not a share, it is a deletion.
ALTER TABLE meal_share_invites
  ADD CONSTRAINT meal_share_invites_copy_factor_check CHECK (copy_factor > 0);

COMMENT ON COLUMN meal_share_invites.copy_factor IS
  'Recipient run / sender run at offer time. Accept multiplies the source meal by this. 1 = verbatim (even split).';
