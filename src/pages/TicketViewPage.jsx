import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Download, Share2, Calendar, MapPin, Clock, User, CheckCircle, XCircle, Phone, CalendarPlus, MessageCircle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import html2canvas from 'html2canvas'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatDate, formatTime } from '../lib/constants'
import toast from 'react-hot-toast'

function buildGoogleCalendarUrl(event) {
  const start = new Date(event.start_at)
  const end = event.end_at ? new Date(event.end_at) : new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const fmt = d => d.toISOString().replace(/[-:]/g, '').replace('.000', '')
  const location = event.venue_name ? `${event.venue_name}, ${event.location || ''}` : (event.location || '')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title || '',
    dates: `${fmt(start)}/${fmt(end)}`,
    details: event.description || '',
    location,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function buildICSContent(event) {
  const start = new Date(event.start_at)
  const end = event.end_at ? new Date(event.end_at) : new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const fmt = d => d.toISOString().replace(/[-:]/g, '').replace('.000', '')
  const location = event.venue_name ? `${event.venue_name}, ${event.location || ''}` : (event.location || '')
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TicketWave//EN',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${event.title || ''}`,
    `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
    `LOCATION:${location}`,
    `UID:${Date.now()}@ticketwave`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}

export default function TicketViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const ticketRef = useRef(null)

  useEffect(() => { fetchTicket() }, [id])

  const fetchTicket = async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select('*, events(title, description, start_at, end_at, location, venue_name, event_type, banner_url, price, currency, online_link), profiles(full_name, email)')
      .eq('id', id)
      .single()
    if (error || !data) { navigate('/tickets'); return }
    if (data.attendee_id !== user?.id) { navigate('/tickets'); return }
    setTicket(data)
    setLoading(false)
  }

  const handleShare = async () => {
    try {
      await navigator.share({ title: `My Ticket: ${ticket.events?.title}`, text: `My QR ticket for ${ticket.events?.title}`, url: window.location.href })
    } catch {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied!')
    }
  }

  const handleDownload = async () => {
    if (!ticketRef.current) return
    setDownloading(true)
    try {
      const canvas = await html2canvas(ticketRef.current, {
        backgroundColor: '#1a1a2e',
        scale: 2,
        useCORS: true,
        logging: false,
      })
      const link = document.createElement('a')
      link.download = `ticket-${ticket.ticket_number}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      toast.success('Ticket downloaded!')
    } catch {
      toast.error('Could not download. Please screenshot this page.')
    } finally {
      setDownloading(false)
    }
  }

  const handleAppleCalendar = () => {
    const icsContent = buildICSContent(ticket.events)
    const blob = new Blob([icsContent], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${ticket.events?.title || 'event'}.ics`
    a.click()
    URL.revokeObjectURL(url)
    setShowCalendar(false)
  }

  if (loading) {
    return (
      <main className="page">
        <div className="container" style={{ paddingTop: '2rem', maxWidth: 600 }}>
          <div className="skeleton" style={{ height: 600, borderRadius: 'var(--radius-2xl)' }} />
        </div>
      </main>
    )
  }

  if (!ticket) return null

  const qrData = JSON.stringify({ ticketId: ticket.id, eventId: ticket.event_id, qrCode: ticket.qr_code, ts: ticket.created_at })
  const isUsed = ticket.status === 'used'
  const isCancelled = ticket.status === 'cancelled'
  const attendeeName = ticket.attendee_name || ticket.profiles?.full_name || user?.email || 'Attendee'

  return (
    <main className="page">
      <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '4rem', maxWidth: 640 }}>
        {/* Actions bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm" id="ticket-view-back"><ArrowLeft size={15} /> Back</button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowCalendar(!showCalendar)}
                className="btn btn-secondary btn-sm"
                id="ticket-calendar"
              >
                <CalendarPlus size={14} /> Add to Calendar
              </button>
              {showCalendar && (
                <div style={{ position: 'absolute', top: '110%', right: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.5rem', zIndex: 50, minWidth: 180, boxShadow: 'var(--shadow-xl)' }}>
                  <a
                    href={buildGoogleCalendarUrl(ticket.events)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowCalendar(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--color-text-2)', textDecoration: 'none', cursor: 'pointer' }}
                    className="dropdown-item"
                  >
                    📅 Google Calendar
                  </a>
                  <button
                    onClick={handleAppleCalendar}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--color-text-2)', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                  >
                    🍎 Apple Calendar (.ics)
                  </button>
                </div>
              )}
            </div>
            <button onClick={handleShare} className="btn btn-secondary btn-sm" id="ticket-share"><Share2 size={14} /> Share</button>
            <a
              href={ticket ? `https://wa.me/?text=${encodeURIComponent(`My ticket for "${ticket.events?.title}"\nView: ${window.location.href}`)}` : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm"
              style={{ color: '#25D366', background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)' }}
              id="ticket-whatsapp"
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
            <button onClick={handleDownload} className="btn btn-secondary btn-sm" disabled={downloading} id="ticket-download">
              {downloading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Download size={14} />} Save
            </button>
          </div>
        </div>

        {/* Ticket card */}
        <div ref={ticketRef} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-2xl)', overflow: 'hidden', position: 'relative' }}>
          {/* Top bar */}
          <div style={{ height: 4, background: isUsed ? 'var(--color-sky)' : isCancelled ? 'var(--color-rose)' : 'var(--gradient-primary)' }} />

          {/* Banner */}
          {ticket.events?.banner_url && (
            <div style={{ height: 180, overflow: 'hidden', position: 'relative' }}>
              <img src={ticket.events.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(26,26,46,1) 0%, transparent 70%)' }} />
            </div>
          )}

          {/* Status overlay */}
          {(isUsed || isCancelled) && (
            <div style={{ position: 'absolute', top: ticket.events?.banner_url ? 140 : 60, right: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.4rem 0.875rem', borderRadius: 'var(--radius-full)', background: isUsed ? 'rgba(14,165,233,0.2)' : 'rgba(244,63,94,0.2)', border: `1px solid ${isUsed ? 'rgba(14,165,233,0.4)' : 'rgba(244,63,94,0.4)'}`, color: isUsed ? 'var(--color-sky)' : 'var(--color-rose)', fontWeight: 700, fontSize: '0.8rem' }}>
              {isUsed ? <CheckCircle size={14} /> : <XCircle size={14} />}
              {isUsed ? 'Used' : 'Cancelled'}
            </div>
          )}

          {/* Body */}
          <div style={{ padding: '1.75rem' }}>
            {/* Ticket type badge */}
            {ticket.ticket_type_name && (
              <div style={{ marginBottom: '0.625rem' }}>
                <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>🎟 {ticket.ticket_type_name}</span>
              </div>
            )}

            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>{ticket.events?.title}</h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: 'var(--color-text-2)', fontSize: '0.9rem' }}>
                <Calendar size={15} style={{ color: 'var(--color-primary-light)', flexShrink: 0 }} />
                {formatDate(ticket.events?.start_at)} · {formatTime(ticket.events?.start_at)}
              </div>
              {(ticket.events?.venue_name || ticket.events?.location) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: 'var(--color-text-2)', fontSize: '0.9rem' }}>
                  <MapPin size={15} style={{ color: 'var(--color-primary-light)', flexShrink: 0 }} />
                  {ticket.events?.venue_name || ticket.events?.location}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: 'var(--color-text-2)', fontSize: '0.9rem' }}>
                <User size={15} style={{ color: 'var(--color-primary-light)', flexShrink: 0 }} />
                {attendeeName}
              </div>
              {ticket.attendee_phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: 'var(--color-text-2)', fontSize: '0.9rem' }}>
                  <Phone size={15} style={{ color: 'var(--color-primary-light)', flexShrink: 0 }} />
                  {ticket.attendee_phone}
                </div>
              )}
            </div>

            {/* Ticket tear divider */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '0 -1.75rem 1.75rem', position: 'relative' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', flexShrink: 0, marginLeft: '-10px' }} />
              <div style={{ flex: 1, borderTop: '2px dashed var(--color-border)' }} />
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', flexShrink: 0, marginRight: '-10px' }} />
            </div>

            {/* QR Code */}
            <div style={{ textAlign: 'center' }}>
              <div id="qr-code-canvas" style={{ display: 'inline-block', background: '#fff', padding: '1.25rem', borderRadius: 'var(--radius-xl)', marginBottom: '1rem', boxShadow: '0 4px 30px rgba(0,0,0,0.3)', filter: isUsed || isCancelled ? 'grayscale(100%) opacity(0.5)' : 'none' }}>
                <QRCodeSVG value={qrData} size={200} fgColor="#09090f" level="H" includeMargin={false} />
              </div>
              <p style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-text-4)', letterSpacing: '0.08em', marginBottom: '0.375rem' }}>{ticket.ticket_number}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-4)' }}>
                {isUsed ? 'This ticket has been scanned ✓' : isCancelled ? 'This ticket is cancelled' : 'Present this QR code at the event entrance'}
              </p>
            </div>

            {/* Online event link */}
            {ticket.events?.online_link && ticket.status === 'active' && (
              <a href={ticket.events.online_link} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }} id="join-online-event">
                Join Online Event
              </a>
            )}
          </div>
        </div>

        <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          <Link to={`/events/${ticket.event_id}`} style={{ fontSize: '0.85rem', color: 'var(--color-primary-light)' }}>View Event Details →</Link>
        </div>
      </div>
    </main>
  )
}
