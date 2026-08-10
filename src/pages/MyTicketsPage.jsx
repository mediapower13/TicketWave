import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Ticket, Calendar, MapPin, CalendarPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatDate, formatTime, formatCurrency, getStatusColor } from '../lib/constants'
import { QRCodeSVG } from 'qrcode.react'

function buildGoogleCalendarUrl(event) {
  if (!event?.start_at) return '#'
  const start = new Date(event.start_at)
  const end = event.end_at ? new Date(event.end_at) : new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const fmt = d => d.toISOString().replace(/[-:]/g, '').replace('.000', '')
  const location = event.venue_name ? `${event.venue_name}, ${event.location || ''}` : (event.location || '')
  const params = new URLSearchParams({ action: 'TEMPLATE', text: event.title || '', dates: `${fmt(start)}/${fmt(end)}`, location })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}


export default function MyTicketsPage() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')

  useEffect(() => { if (user) fetchTickets() }, [user])

  const fetchTickets = async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select('*, events(title, start_at, end_at, location, venue_name, event_type, banner_url, price, currency)')
      .eq('attendee_id', user.id)
      .order('created_at', { ascending: false })
    if (!error) setTickets(data || [])
    setLoading(false)
  }

  const filtered = tickets.filter(t => filter === 'all' ? true : t.status === filter)
  const counts = {
    all: tickets.length,
    active: tickets.filter(t => t.status === 'active').length,
    used: tickets.filter(t => t.status === 'used').length,
  }

  return (
    <main className="page">
      <div className="page-header">
        <div className="container">
          <h1 className="page-header-title">My Tickets</h1>
          <p className="page-header-subtitle">All your event tickets in one place</p>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: '4rem' }}>
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {[{ key: 'active', label: `Active (${counts.active})` }, { key: 'used', label: `Used (${counts.used})` }, { key: 'all', label: `All (${counts.all})` }].map(tab => (
            <button key={tab.key} className={`filter-chip ${filter === tab.key ? 'active' : ''}`} onClick={() => setFilter(tab.key)} id={`tickets-filter-${tab.key}`}>{tab.label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[...Array(3)].map((_, i) => <div key={i} className="ticket-card"><div className="ticket-card-body"><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}><div className="skeleton" style={{ height: 20, width: '70%' }} /><div className="skeleton" style={{ height: 14, width: '50%' }} /></div><div className="skeleton" style={{ width: 100, height: 100, borderRadius: 'var(--radius-md)' }} /></div></div>)}
          </div>
        ) : filtered.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filtered.map(ticket => (
              <div key={ticket.id} className="ticket-card" style={{ opacity: ticket.status === 'cancelled' ? 0.6 : 1 }}>
                <div className="ticket-card-body">
                  {ticket.events?.banner_url && (
                    <div style={{ width: 72, height: 72, flexShrink: 0, borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--color-bg-3)' }}>
                      <img src={ticket.events.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}

                  <div className="ticket-card-info" style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                      <p className="ticket-card-event">{ticket.events?.title}</p>
                      <span className={`badge badge-${getStatusColor(ticket.status)}`}>{ticket.status}</span>
                    </div>

                    {ticket.ticket_type_name && (
                      <div style={{ marginBottom: '0.375rem' }}>
                        <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>🎟 {ticket.ticket_type_name}</span>
                      </div>
                    )}

                    <div className="ticket-card-meta">
                      <div className="ticket-card-meta-item"><Calendar size={12} /><span>{formatDate(ticket.events?.start_at)} · {formatTime(ticket.events?.start_at)}</span></div>
                      {(ticket.events?.venue_name || ticket.events?.location) && (
                        <div className="ticket-card-meta-item"><MapPin size={12} /><span>{ticket.events?.venue_name || ticket.events?.location}</span></div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <p className="ticket-card-number">{ticket.ticket_number}</p>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {ticket.status === 'active' && (
                          <a
                            href={buildGoogleCalendarUrl(ticket.events)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="btn btn-sm btn-ghost"
                            style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
                            title="Add to Google Calendar"
                          >
                            <CalendarPlus size={12} /> Calendar
                          </a>
                        )}
                        <Link
                          to={`/tickets/${ticket.id}`}
                          className="btn btn-sm btn-primary"
                          style={{ fontSize: '0.72rem', padding: '0.25rem 0.625rem' }}
                          id={`ticket-view-${ticket.id}`}
                        >
                          View Ticket
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Mini QR */}
                  <div className="ticket-card-qr">
                    <div className="ticket-card-qr-container">
                      <QRCodeSVG value={JSON.stringify({ ticketId: ticket.id, eventId: ticket.event_id, qrCode: ticket.qr_code })} size={80} fgColor="#09090f" />
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--color-text-4)', textAlign: 'center' }}>Tap to view</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><Ticket size={28} /></div>
            <h3 className="empty-state-title">No tickets yet</h3>
            <p className="empty-state-text">{filter === 'active' ? "You don't have any active tickets. Browse events and get your first ticket!" : "No tickets in this category."}</p>
            <Link to="/events" className="btn btn-primary" id="browse-events-btn">Browse Events</Link>
          </div>
        )}
      </div>
    </main>
  )
}
