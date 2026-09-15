-- ============================================================
-- PAIRING SESSIONS & DEVICES UPDATE
-- ============================================================

-- 1. Add status to devices if it does not exist
ALTER TABLE devices
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked'));

-- Create pairing_sessions table
CREATE TABLE IF NOT EXISTS pairing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  device_id uuid REFERENCES devices(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure code is unique for active pending sessions
CREATE UNIQUE INDEX IF NOT EXISTS idx_pairing_sessions_code_active 
ON pairing_sessions(code) WHERE status = 'pending';

ALTER TABLE pairing_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_pairing_sessions" ON pairing_sessions;
CREATE POLICY "select_own_pairing_sessions" ON pairing_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_pairing_sessions" ON pairing_sessions;
CREATE POLICY "insert_own_pairing_sessions" ON pairing_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_pairing_sessions" ON pairing_sessions;
CREATE POLICY "update_own_pairing_sessions" ON pairing_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_pairing_sessions" ON pairing_sessions;
CREATE POLICY "delete_own_pairing_sessions" ON pairing_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pairing_sessions_user_id ON pairing_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_pairing_sessions_code ON pairing_sessions(code);

-- Update trigger
DROP TRIGGER IF EXISTS set_updated_at ON pairing_sessions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON pairing_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
