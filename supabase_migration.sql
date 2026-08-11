-- ============================================================
-- TicketWave -- SAFE Re-runnable Migration
-- This version handles "already exists" errors gracefully.
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. ticket_types table (safe - skips if already exists)
CREATE TABLE IF NOT EXISTS ticket_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  price         NUMERIC NOT NULL DEFAULT 0,
  quantity      INTEGER NOT NULL DEFAULT 100,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (safe to run twice)
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first, then recreate (avoids "already exists" error)
DROP POLICY IF EXISTS "Public can read ticket_types" ON ticket_types;
DROP POLICY IF EXISTS "Public read ticket_types" ON ticket_types;
DROP POLICY IF EXISTS "Organizer can manage ticket_types" ON ticket_types;
DROP POLICY IF EXISTS "Organizer manage ticket_types" ON ticket_types;

CREATE POLICY "Public can read ticket_types"
  ON ticket_types FOR SELECT USING (true);

CREATE POLICY "Organizer can manage ticket_types"
  ON ticket_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = ticket_types.event_id
        AND events.organizer_id = auth.uid()
    )
  );

-- ============================================================
-- 2. Extend tickets table (IF NOT EXISTS is safe)
-- ============================================================
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS ticket_type_id   UUID REFERENCES ticket_types(id),
  ADD COLUMN IF NOT EXISTS ticket_type_name TEXT,
  ADD COLUMN IF NOT EXISTS attendee_name    TEXT,
  ADD COLUMN IF NOT EXISTS attendee_phone   TEXT,
  ADD COLUMN IF NOT EXISTS amount_paid      NUMERIC,
  ADD COLUMN IF NOT EXISTS scanned_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scanned_by       UUID REFERENCES auth.users(id);

-- ============================================================
-- 3. Extend orders table (IF NOT EXISTS is safe)
-- ============================================================
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- ============================================================
-- DONE! All tables and columns are now in place.
-- ============================================================
