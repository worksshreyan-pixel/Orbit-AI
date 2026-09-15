-- Add priority and speak columns to notifications

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
ADD COLUMN IF NOT EXISTS speak boolean NOT NULL DEFAULT false;

-- Drop and recreate the view if one existed (none exist in standard schema but just in case)
-- Also ensure updated_at trigger is functional if needed, but notifications doesn't have one in Orbit currently.
