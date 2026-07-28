-- =====================================================
-- EVENTS TICKETING APP — SUPABASE SQL SETUP
-- Run this entire script in Supabase > SQL Editor
-- =====================================================

-- 1. PROFILES TABLE (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'attendee' CHECK (role IN ('attendee', 'organizer', 'admin')),
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organizer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  banner_url TEXT,
  location TEXT,
  venue_name TEXT,
  event_type TEXT NOT NULL DEFAULT 'physical' CHECK (event_type IN ('physical', 'online', 'hybrid')),
  online_link TEXT,
  category TEXT DEFAULT 'general',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  capacity INTEGER NOT NULL DEFAULT 100,
  tickets_sold INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TICKETS TABLE
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  attendee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  qr_code TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'cancelled', 'refunded')),
  ticket_number TEXT UNIQUE,
  scanned_at TIMESTAMPTZ,
  scanned_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  attendee_id UUID REFERENCES public.profiles(id) NOT NULL,
  event_id UUID REFERENCES public.events(id) NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_reference TEXT,
  payment_method TEXT,
  paystack_reference TEXT,
  email_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TICKET NUMBER GENERATOR
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ticket_number := 'TKT-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ticket_number
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION generate_ticket_number();

-- AUTO-UPDATE updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'attendee')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- INCREMENT TICKETS SOLD
CREATE OR REPLACE FUNCTION increment_tickets_sold()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.events
  SET tickets_sold = tickets_sold + 1
  WHERE id = NEW.event_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_ticket_created
  AFTER INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION increment_tickets_sold();

-- ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Published events are viewable by everyone"
  ON public.events FOR SELECT
  USING (status = 'published' OR organizer_id = auth.uid());

CREATE POLICY "Organizers can create events"
  ON public.events FOR INSERT
  WITH CHECK (
    auth.uid() = organizer_id AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('organizer', 'admin'))
  );

CREATE POLICY "Organizers can update their own events"
  ON public.events FOR UPDATE
  USING (organizer_id = auth.uid());

CREATE POLICY "Organizers can delete their own events"
  ON public.events FOR DELETE
  USING (organizer_id = auth.uid());

CREATE POLICY "Attendees can view their own tickets"
  ON public.tickets FOR SELECT
  USING (
    attendee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = tickets.event_id AND e.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create tickets"
  ON public.tickets FOR INSERT
  WITH CHECK (auth.uid() = attendee_id);

CREATE POLICY "Organizers can update ticket status"
  ON public.tickets FOR UPDATE
  USING (
    attendee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = tickets.event_id AND e.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT
  USING (
    attendee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = orders.event_id AND e.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = attendee_id);

CREATE POLICY "Users can update their own orders"
  ON public.orders FOR UPDATE
  USING (attendee_id = auth.uid());

-- STORAGE
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-banners', 'event-banners', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Event banners are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-banners');

CREATE POLICY "Organizers can upload event banners"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-banners' AND auth.role() = 'authenticated');
