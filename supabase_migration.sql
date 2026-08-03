-- ============================================================
-- TicketWave MVP — Database Migration
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Create ticket_types table
-- This allows each event to have multiple ticket tiers
-- (e.g. General ₦5,000 | VIP ₦15,000 | Early Bird Free)
CREATE TABLE IF NOT EXISTS ticket_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  price           NUMERIC NOT NULL DEFAULT 0,
  quantity        INTEGER NOT NULL DEFAULT 100,
  quantity_sold   INTEGER NOT NULL DEFAULT 0,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;

-- Anyone can read ticket types (needed to show on event page)
CREATE POLICY "Public can read ticket_types"
  ON ticket_types FOR SELECT
  USING (true);

-- Only the event organizer can create/edit/delete ticket types
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

-- 2. Extend the tickets table with new fields
--    (IF NOT EXISTS is safe — won't error if already added)
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS ticket_type_id  UUID REFERENCES ticket_types(id),
  ADD COLUMN IF NOT EXISTS ticket_type_name TEXT,
  ADD COLUMN IF NOT EXISTS attendee_name   TEXT,
  ADD COLUMN IF NOT EXISTS attendee_phone  TEXT,
  ADD COLUMN IF NOT EXISTS amount_paid     NUMERIC;

-- ============================================================

-- 3. Extend the orders table with payment_method if missing
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- ============================================================
-- DONE! You can now use:
--   - ticket_types table for VIP/Early Bird/Free tiers
--   - tickets.ticket_type_name for door scanning
--   - tickets.attendee_name / phone for check-in list
--   - tickets.amount_paid for real ₦ revenue tracking
-- ============================================================
