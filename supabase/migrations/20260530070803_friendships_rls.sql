-- =============================================================================
-- Domain B: Database Security & Logic — friendships RLS
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- friendships is the symmetric, canonical-ordered friend edge
-- (user_low < user_high enforced by a table CHECK). Both parties may read and
-- mutate the row; everyone else sees nothing.
--
--   SELECT  — visible only to the two parties.
--   INSERT  — only an involved party may create the edge, and only as the
--             requester (requested_by = auth.uid()); new edges start 'pending'.
--   UPDATE  — either party may update, BUT an accept (status -> 'accepted')
--             is only valid when auth.uid() <> requested_by, so the requester
--             can never self-accept their own outgoing request. Either party
--             may set 'blocked'.
--
-- Copy-link invites create a PENDING request after signup (never auto-accept);
-- that PENDING row is just an ordinary INSERT here, accepted later via UPDATE.
-- =============================================================================

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties can view their friendships"
  ON public.friendships FOR SELECT
  TO authenticated
  USING (auth.uid() IN (user_low, user_high));

CREATE POLICY "Requester can create a friendship request"
  ON public.friendships FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (user_low, user_high)
    AND auth.uid() = requested_by
  );

-- UPDATE: either party may update the row. The WITH CHECK gates the resulting
-- status: an 'accepted' result requires the actor to be the NON-requester
-- (the recipient accepting); 'pending' and 'blocked' results are allowed for
-- either party.
CREATE POLICY "Parties can update their friendship status"
  ON public.friendships FOR UPDATE
  TO authenticated
  USING (auth.uid() IN (user_low, user_high))
  WITH CHECK (
    auth.uid() IN (user_low, user_high)
    AND (
      status <> 'accepted'
      OR auth.uid() <> requested_by
    )
  );

-- Reuse the shared updated_at trigger function (defined in 20260228155945).
CREATE TRIGGER on_friendships_updated
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
