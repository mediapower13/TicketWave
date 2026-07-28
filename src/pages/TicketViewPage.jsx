import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Download, Share2, Calendar, MapPin, Clock, User, CheckCircle, XCircle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatDate, formatTime } from '../lib/constants'
import toast from 'react-hot-toast'

export default function TicketViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const ticketRef = useRef(null)

  useEffect(() => {
    fetchTicket()
  }, [id])

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

  const handleDownload = () => {
    const canvas = document.querySelector('#qr-code-canvas canvas') || document.querySelector('#qr-code-canvas svg')
    if (!canvas) { toast.error('Could not find QR code'); return }
    toast.success('Download feature: Take a screenshot of this page for your ticket!')
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

  const qrData = JSON.stringify({
    ticketId: ticket.id,
    eventId: ticket.event_id,
    qrCode: ticket.qr_code,
    ts: ticket.created_at,
  })

  const isUsed = ticket.status === 'used'
  const isCancelled = ticket.status === 'cancelled'

  return (
    <main className="page">
      <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '4rem', maxWidth: 640 }}>
        {/* Back */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm" id="ticket-view-back">
            <ArrowLeft size={15} /> Back
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleShare} className="btn btn-secondary btn-sm" id="ticket-share">
              <Share2 size={14} /> Share
            </button>
            <button onClick={handleDownload} className="btn btn-secondary btn-sm" id="ticket-download">
              <Download size={14} /> Save
            </button>
          </div>
        </div>

        {/* Ticket card */}
        <div ref={ticketRef} style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-2xl)',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Top gradient bar */}
          <div style={{ height: 4, background: isUsed ? 'var(--color-sky)' : isCancelled ? 'var(--color-rose)' : 'var(--gradient-primary)' }} />

          {/* Banner */}
          {ticket.events?.banner_url && (
            <div style={{ height: 180, overflow: 'hidden', position: 'relative' }}>
              <img src={ticket.events.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(26,26,46,1) 0%, transparent 70%)' }} />
            </div>
          )}

          {/* Status overlay */}
          {(isUsed || isCancelled) && (
            <div style={{
              position: 'absolute',
              top: ticket.events?.banner_url ? 140 : 60,
              right: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.4rem 0.875rem',
              borderRadius: 'var(--radius-full)',
              background: isUsed ? 'rgba(14,165,233,0.2)' : 'rgba(244,63,94,0.2)',
              border: `1px solid ${isUsed ? 'rgba(14,165,233,0.4)' : 'rgba(244,63,94,0.4)'}`,
              color: isUsed ? 'var(--color-sky)' : 'var(--color-rose)',
              fontWeight: 700,
              fontSize: '0.8rem',
            }}>
              {isUsed ? <CheckCircle size={14} /> : <XCircle size={14} />}
              {isUsed ? 'Used' : 'Cancelled'}
            </div>
          )}

          {/* Ticket body */}
          <div style={{ padding: '1.75rem' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>
              {ticket.events?.title}
            </h1>

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
                {ticket.profiles?.full_name || user?.email}
              </div>
            </div>

            {/* Divider */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              margin: '0 -1.75rem 1.75rem',
              position: 'relative',
            }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', flexShrink: 0, marginLeft: '-10px' }} />
              <div style={{ flex: 1, borderTop: '2px dashed var(--color-border)' }} />
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', flexShrink: 0, marginRight: '-10px' }} />
            </div>

            {/* QR Code */}
            <div style={{ textAlign: 'center' }}>
              <div
                id="qr-code-canvas"
                style={{
                  display: 'inline-block',
                  background: '#fff',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-xl)',
                  marginBottom: '1rem',
                  boxShadow: '0 4px 30px rgba(0,0,0,0.3)',
                  filter: isUsed || isCancelled ? 'grayscale(100%) opacity(0.5)' : 'none',
                }}
              >
                <QRCodeSVG
                  value={qrData}
                  size={200}
                  fgColor="#09090f"
                  level="H"
                  includeMargin={false}
                />
              </div>

              <p style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-text-4)', letterSpacing: '0.08em', marginBottom: '0.375rem' }}>
                {ticket.ticket_number}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-4)' }}>
                {isUsed ? 'This ticket has been scanned' : isCancelled ? 'This ticket is cancelled' : 'Present this QR code at the event entrance'}
              </p>
            </div>

            {/* Online link */}
            {ticket.events?.online_link && ticket.status === 'active' && (
              <a
                href={ticket.events.online_link}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '1.5rem' }}
                id="join-online-event"
              >
                Join Online Event
              </a>
            )}
          </div>
        </div>

        {/* More info */}
        <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          <Link to={`/events/${ticket.event_id}`} style={{ fontSize: '0.85rem', color: 'var(--color-primary-light)' }}>
            View Event Details →
          </Link>
        </div>
      </div>
    </main>
  )
}
