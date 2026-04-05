-- Enable RLS and add user-scoped policy for pending_analyses
ALTER TABLE "pending_analyses" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own pending analyses"
  ON "pending_analyses"
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
