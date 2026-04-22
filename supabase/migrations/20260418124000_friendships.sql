-- 017: friendships and friend requests
CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id uuid NOT NULL REFERENCES students ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES students ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

CREATE INDEX IF NOT EXISTS friendships_requester_idx ON friendships(requester_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON friendships(addressee_id, status, created_at DESC);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friendships_involved_select" ON friendships;
CREATE POLICY "friendships_involved_select" ON friendships FOR SELECT
  USING (
    requester_id IN (SELECT id FROM students WHERE user_id = auth.uid())
    OR addressee_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "friendships_request_insert" ON friendships;
CREATE POLICY "friendships_request_insert" ON friendships FOR INSERT
  WITH CHECK (requester_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "friendships_addressee_update" ON friendships;
CREATE POLICY "friendships_addressee_update" ON friendships FOR UPDATE
  USING (addressee_id IN (SELECT id FROM students WHERE user_id = auth.uid()))
  WITH CHECK (addressee_id IN (SELECT id FROM students WHERE user_id = auth.uid()));
