import { useNavigate } from 'react-router-dom'
import { MapPin, Calendar, Users, Globe, Wifi } from 'lucide-react'
import { formatDate, formatTime, formatCurrency } from '../lib/constants'

export default function EventCard({ event }) {
  const navigate = useNavigate()

  const startDate = new Date(event.start_at)
  const day = startDate.getDate()
  const month = startDate.toLocaleString('en', { month: 'short' }).toUpperCase()

  const availableSpots = event.capacity - (event.tickets_sold || 0)
  const isSoldOut = availableSpots <= 0
  const isAlmostFull = availableSpots <= event.capacity * 0.1 && !isSoldOut

  const typeColors = {
    physical: 'sky',
    online: 'emerald',
    hybrid: 'gold',
  }

  return (
    <article
      className="event-card"
      onClick={() => navigate(`/events/${event.id}`)}
      id={`event-card-${event.id}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/events/${event.id}`)}
    >
      {/* Banner */}
      <div className="event-card-banner">
        {event.banner_url ? (
          <img src={event.banner_url} alt={event.title} loading="lazy" />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #1a1a2e, #2d1b69)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ fontSize: '3rem', opacity: 0.3 }}>🎟️</div>
          </div>
        )}
        <div className="event-card-banner-overlay" />

        {/* Date badge */}
        <div className="event-card-date-badge">
          <div className="event-card-date-day">{day}</div>
          <div className="event-card-date-month">{month}</div>
        </div>

        {/* Type badge */}
        <div className="event-card-type-badge">
          <span className={`badge badge-${typeColors[event.event_type] || 'gray'}`}>
            {event.event_type === 'online' ? <Wifi size={9} /> : <Globe size={9} />}
            {event.event_type}
          </span>
        </div>

        {isSoldOut && (
          <div style={{
            position: 'absolute',
            bottom: '0.75rem',
            left: '50%',
            transform: 'translateX(-50%)',
          }}>
            <span className="badge badge-rose">Sold Out</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="event-card-body">
        <div className="event-card-category">{event.category}</div>
        <h3 className="event-card-title">{event.title}</h3>

        <div className="event-card-meta">
          <div className="event-card-meta-item">
            <Calendar size={13} />
            <span>{formatDate(event.start_at)} · {formatTime(event.start_at)}</span>
          </div>
          {(event.location || event.venue_name) && (
            <div className="event-card-meta-item">
              <MapPin size={13} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {event.venue_name || event.location}
              </span>
            </div>
          )}
          <div className="event-card-meta-item">
            <Users size={13} />
            <span>
              {isSoldOut
                ? 'Sold out'
                : isAlmostFull
                ? `Only ${availableSpots} left!`
                : `${availableSpots} spots available`
              }
            </span>
          </div>
        </div>

        <div className="event-card-footer">
          <div className={`event-card-price ${event.price === 0 ? 'free' : 'paid'}`}>
            {formatCurrency(event.price, event.currency)}
          </div>
          <button
            className={`btn btn-sm ${isSoldOut ? 'btn-ghost' : 'btn-primary'}`}
            disabled={isSoldOut}
            onClick={(e) => { e.stopPropagation(); navigate(`/events/${event.id}`) }}
          >
            {isSoldOut ? 'View' : 'Get Ticket'}
          </button>
        </div>
      </div>
    </article>
  )
}
