import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap, ArrowRight, MapPin, Calendar, Shield, Star, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import EventCard from '../components/EventCard'

const FEATURES = [
  {
    icon: <Zap size={22} />,
    title: 'Instant QR Tickets',
    desc: 'Get your QR code ticket instantly after payment — in-app and via email.',
    color: 'var(--color-primary-light)',
  },
  {
    icon: <Shield size={22} />,
    title: 'Secure Payments',
    desc: 'Pay with your Nigerian bank, OPay, Kuda, card, USSD or bank transfer via Paystack.',
    color: 'var(--color-emerald)',
  },
  {
    icon: <Star size={22} />,
    title: 'Physical & Online Events',
    desc: 'Discover concerts, conferences, webinars and more all in one place.',
    color: 'var(--color-gold)',
  },
  {
    icon: <TrendingUp size={22} />,
    title: 'Organizer Dashboard',
    desc: 'Create events, track sales, manage attendees and scan tickets at the door.',
    color: 'var(--color-sky)',
  },
]

const CATEGORIES = [
  { label: 'Music', emoji: '🎵' },
  { label: 'Technology', emoji: '💻' },
  { label: 'Food & Drinks', emoji: '🍽️' },
  { label: 'Sports', emoji: '⚽' },
  { label: 'Arts & Culture', emoji: '🎨' },
  { label: 'Business', emoji: '💼' },
  { label: 'Comedy', emoji: '😂' },
  { label: 'Education', emoji: '📚' },
]

export default function HomePage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const fetchFeaturedEvents = async () => {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .gte('start_at', new Date().toISOString())
        .order('start_at', { ascending: true })
        .limit(6)
      setEvents(data || [])
      setLoading(false)
    }
    fetchFeaturedEvents()
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    navigate(`/events?q=${encodeURIComponent(search)}`)
  }

  return (
    <main className="page" style={{ paddingTop: 0 }}>
      {/* HERO */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-orb hero-orb-3" />
        </div>

        <div className="container" style={{ paddingTop: '8rem', paddingBottom: '5rem', position: 'relative', zIndex: 1 }}>
          <div className="hero-content">
            <div className="hero-eyebrow">
              <Zap size={12} />
              Nigeria's #1 Event Ticketing Platform
            </div>

            <h1 className="hero-title">
              Experience Events<br />
              <span className="hero-title-gradient">Like Never Before</span>
            </h1>

            <p className="hero-subtitle">
              Discover and attend the best events in Nigeria. Get instant QR tickets, pay with your bank, OPay, or card — zero hassle.
            </p>

            {/* Search bar */}
            <form onSubmit={handleSearch} style={{ marginBottom: '2.5rem' }}>
              <div style={{
                display: 'flex',
                gap: '0.75rem',
                background: 'rgba(26,26,46,0.8)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(124,58,237,0.25)',
                borderRadius: '1rem',
                padding: '0.5rem 0.5rem 0.5rem 1.25rem',
                maxWidth: 520,
              }}>
                <input
                  id="hero-search"
                  type="text"
                  placeholder="Search events, artists, venues..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--color-text)',
                    fontSize: '0.95rem',
                  }}
                />
                <button type="submit" className="btn btn-primary">
                  Search <ArrowRight size={15} />
                </button>
              </div>
            </form>

            <div className="hero-actions">
              <Link to="/events" className="btn btn-primary btn-lg" id="hero-browse-events">
                Browse Events <ArrowRight size={16} />
              </Link>
              <Link to="/auth?tab=signup&role=organizer" className="btn btn-ghost btn-lg" id="hero-create-event">
                Create an Event
              </Link>
            </div>

            <div className="hero-stats">
              <div className="hero-stat">
                <div className="hero-stat-number">10K+</div>
                <div className="hero-stat-label">Events Hosted</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-number">500K+</div>
                <div className="hero-stat-label">Tickets Sold</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-number">50+</div>
                <div className="hero-stat-label">Cities Covered</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="section" style={{ paddingTop: '4rem', paddingBottom: '2rem' }}>
        <div className="container">
          <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {CATEGORIES.map(cat => (
              <Link
                key={cat.label}
                to={`/events?category=${encodeURIComponent(cat.label)}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '1rem 1.5rem',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.25s',
                  textDecoration: 'none',
                }}
                className="category-card"
              >
                <span style={{ fontSize: '1.8rem' }}>{cat.emoji}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-2)' }}>{cat.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED EVENTS */}
      <section className="section">
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div className="section-eyebrow">Featured</div>
              <h2 className="section-title" style={{ margin: 0 }}>Upcoming Events</h2>
            </div>
            <Link to="/events" className="btn btn-secondary" id="home-view-all">
              View All <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="grid-auto">
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                  <div className="skeleton" style={{ height: 200 }} />
                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="skeleton" style={{ height: 14, width: '60%' }} />
                    <div className="skeleton" style={{ height: 20, width: '85%' }} />
                    <div className="skeleton" style={{ height: 14, width: '70%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length > 0 ? (
            <div className="grid-auto">
              {events.map(event => <EventCard key={event.id} event={event} />)}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Calendar size={28} />
              </div>
              <h3 className="empty-state-title">No events yet</h3>
              <p className="empty-state-text">Be the first to create an event on TicketWave!</p>
              <Link to="/auth?tab=signup&role=organizer" className="btn btn-primary">
                Create an Event
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* FEATURES */}
      <section className="section" style={{ background: 'linear-gradient(180deg, transparent, rgba(124,58,237,0.04), transparent)' }}>
        <div className="container">
          <div className="section-header">
            <div className="section-eyebrow">Why TicketWave</div>
            <h2 className="section-title">Everything you need</h2>
            <p className="section-subtitle">From discovery to door-scan — the complete event experience, built for Nigeria.</p>
          </div>

          <div className="grid-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56,
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `${f.color}18`,
                  border: `1px solid ${f.color}30`,
                  color: f.color,
                  margin: '0 auto 1.25rem',
                }}>
                  {f.icon}
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>{f.title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-3)', lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="container">
          <div style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(168,85,247,0.08), rgba(236,72,153,0.08))',
            border: '1px solid rgba(124,58,237,0.25)',
            borderRadius: 'var(--radius-2xl)',
            padding: '4rem 2rem',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: '-100px', right: '-100px',
              width: 300, height: 300,
              background: 'var(--color-primary)',
              borderRadius: '50%',
              filter: 'blur(100px)',
              opacity: 0.12,
            }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 900, marginBottom: '1rem', position: 'relative' }}>
              Ready to host your event?
            </h2>
            <p style={{ color: 'var(--color-text-2)', marginBottom: '2rem', fontSize: '1.05rem', position: 'relative', maxWidth: 500, margin: '0 auto 2rem' }}>
              Join hundreds of organizers already using TicketWave to sell tickets and manage their events.
            </p>
            <Link to="/auth?tab=signup&role=organizer" className="btn btn-primary btn-lg glow-pulse" id="cta-organizer-signup" style={{ position: 'relative' }}>
              Start for Free <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
