import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { MapPin, Calendar, Clock, Users, Globe, Share2, ArrowLeft, Wifi, CheckCircle, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatDate, formatTime, formatCurrency, getEventTypeLabel } from '../lib/constants'
import { initializePaystack, generateReference } from '../lib/paystack'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'

export default function EventDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [userTicket, setUserTicket] = useState(null)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    fetchEvent()
    if (user) checkUserTicket()
  }, [id, user])

  const fetchEvent = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*, profiles(full_name, avatar_url)')
      .eq('id', id)
      .single()
    if (error || !data) { navigate('/events'); return }
    setEvent(data)
    setLoading(false)
  }

  const checkUserTicket = async () => {
    if (!user) return
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .eq('event_id', id)
      .eq('attendee_id', user.id)
      .eq('status', 'active')
      .single()
    setUserTicket(data || null)
  }

  const handlePurchase = async () => {
    if (!user) { navigate('/auth'); return }
    if (event.price === 0) {
      await createFreeTicket()
    } else {
      setShowModal(true)
    }
  }

  const createFreeTicket = async () => {
    setPurchasing(true)
    try {
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({ event_id: event.id, attendee_id: user.id })
        .select()
        .single()
      if (ticketError) throw ticketError

      await supabase.from('orders').insert({
        ticket_id: ticket.id,
        attendee_id: user.id,
        event_id: event.id,
        amount: 0,
        payment_status: 'completed',
      })

      setUserTicket(ticket)
      toast.success('Free ticket registered! 🎉')
      setShowModal(false)
    } catch (err) {
      toast.error('Failed to register ticket')
    } finally {
      setPurchasing(false)
    }
  }

  const handlePaystackPayment = () => {
    const ref = generateReference('TW')
    initializePaystack({
      email: user.email,
      amount: event.price * quantity,
      reference: ref,
      currency: event.currency || 'NGN',
      metadata: {
        'Event': event.title,
        'Attendee': profile?.full_name || user.email,
        'Quantity': quantity,
      },
      onSuccess: async (response) => {
        setPurchasing(true)
        try {
          const { data: ticket, error } = await supabase
            .from('tickets')
            .insert({ event_id: event.id, attendee_id: user.id })
            .select()
            .single()
          if (error) throw error

          await supabase.from('orders').insert({
            ticket_id: ticket.id,
            attendee_id: user.id,
            event_id: event.id,
            amount: event.price * quantity,
            currency: event.currency || 'NGN',
            payment_status: 'completed',
            paystack_reference: response.reference,
            payment_method: 'paystack',
          })

          setUserTicket(ticket)
          setShowModal(false)
          toast.success('Ticket purchased! Check your email for the QR code 🎉')
        } catch (err) {
          toast.error('Payment received but ticket creation failed. Contact support.')
        } finally {
          setPurchasing(false)
        }
      },
      onClose: () => {
        toast('Payment cancelled', { icon: '⚠️' })
      },
    })
  }

  const handleShare = async () => {
    try {
      await navigator.share({
        title: event.title,
        text: `Check out this event: ${event.title}`,
        url: window.location.href,
      })
    } catch {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied!')
    }
  }

  if (loading) {
    return (
      <main className="page">
        <div className="container" style={{ paddingTop: '2rem' }}>
          <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-2xl)', marginBottom: '2rem' }} />
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="skeleton" style={{ height: 40, width: '70%' }} />
              <div className="skeleton" style={{ height: 20, width: '50%' }} />
              <div className="skeleton" style={{ height: 120 }} />
            </div>
            <div style={{ flex: '0 0 320px' }}>
              <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-xl)' }} />
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (!event) return null

  const availableSpots = event.capacity - (event.tickets_sold || 0)
  const isSoldOut = availableSpots <= 0
  const percentSold = Math.round(((event.tickets_sold || 0) / event.capacity) * 100)

  return (
    <main className="page">
      <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '4rem' }}>
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="btn btn-ghost btn-sm"
          style={{ marginBottom: '1.5rem', gap: '0.375rem' }}
          id="event-detail-back"
        >
          <ArrowLeft size={15} /> Back
        </button>

        {/* Banner */}
        <div style={{
          width: '100%', height: 360,
          borderRadius: 'var(--radius-2xl)',
          overflow: 'hidden',
          marginBottom: '2rem',
          position: 'relative',
          background: 'linear-gradient(135deg, #1a1a2e, #2d1b69)',
        }}>
          {event.banner_url && (
            <img src={event.banner_url} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(9,9,15,0.7) 0%, transparent 60%)' }} />
          <div style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem', display: 'flex', gap: '0.5rem' }}>
            <span className={`badge badge-${event.event_type === 'online' ? 'emerald' : event.event_type === 'hybrid' ? 'gold' : 'sky'}`}>
              {event.event_type === 'online' ? <Wifi size={10} /> : <Globe size={10} />}
              {getEventTypeLabel(event.event_type)}
            </span>
            <span className="badge badge-gray">{event.category}</span>
          </div>
          <button
            onClick={handleShare}
            className="btn btn-sm"
            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(9,9,15,0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
            id="event-share"
          >
            <Share2 size={14} /> Share
          </button>
        </div>

        {/* Content layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem', alignItems: 'start' }}>
          {/* Left: event info */}
          <div className="fade-in">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
                  {event.title}
                </h1>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-3)' }}>
                  Organized by <span style={{ color: 'var(--color-text-2)', fontWeight: 600 }}>{event.profiles?.full_name || 'Unknown'}</span>
                </p>
              </div>
            </div>

            {/* Meta */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              padding: '1.5rem',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary-light)', marginBottom: '0.375rem' }}>
                  <Calendar size={15} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</span>
                </div>
                <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{formatDate(event.start_at)}</p>
                {event.end_at && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-3)' }}>to {formatDate(event.end_at)}</p>}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary-light)', marginBottom: '0.375rem' }}>
                  <Clock size={15} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time</span>
                </div>
                <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{formatTime(event.start_at)}</p>
              </div>
              {event.location && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary-light)', marginBottom: '0.375rem' }}>
                    <MapPin size={15} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location</span>
                  </div>
                  <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{event.venue_name || event.location}</p>
                  {event.venue_name && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-3)' }}>{event.location}</p>}
                </div>
              )}
              {event.online_link && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-emerald)', marginBottom: '0.375rem' }}>
                    <Globe size={15} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Online Link</span>
                  </div>
                  <a
                    href={event.online_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--color-emerald)', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    {userTicket ? 'Join Event' : 'Available after ticket purchase'} {userTicket && <ExternalLink size={12} />}
                  </a>
                </div>
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary-light)', marginBottom: '0.375rem' }}>
                  <Users size={15} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Capacity</span>
                </div>
                <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{availableSpots} spots left</p>
                <div style={{ marginTop: '0.375rem', height: 4, borderRadius: 4, background: 'var(--color-border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${percentSold}%`, background: percentSold > 80 ? 'var(--color-rose)' : 'var(--gradient-primary)', borderRadius: 4, transition: 'width 0.5s ease' }} />
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-4)', marginTop: '0.25rem' }}>{percentSold}% filled</p>
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>About this Event</h2>
              <div style={{
                color: 'var(--color-text-2)',
                lineHeight: 1.8,
                fontSize: '0.95rem',
                whiteSpace: 'pre-wrap',
              }}>
                {event.description || 'No description provided.'}
              </div>
            </div>

            {/* Tags */}
            {event.tags?.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {event.tags.map(tag => (
                  <span key={tag} className="badge badge-primary">#{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Right: Ticket purchase card */}
          <div style={{ position: 'sticky', top: '88px' }}>
            <div className="card" style={{ padding: '1.75rem' }}>
              {/* Already have ticket */}
              {userTicket ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 56, height: 56,
                    background: 'rgba(16,185,129,0.15)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 1rem',
                    color: 'var(--color-emerald)',
                  }}>
                    <CheckCircle size={24} />
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '0.5rem' }}>You\'re In!</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-3)', marginBottom: '1.5rem' }}>You have a ticket for this event.</p>
                  <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1.25rem', display: 'inline-block' }}>
                    <QRCodeSVG
                      value={JSON.stringify({ ticketId: userTicket.id, eventId: event.id, qrCode: userTicket.qr_code })}
                      size={140}
                      fgColor="#09090f"
                    />
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-4)', fontFamily: 'monospace', marginBottom: '1.25rem' }}>
                    {userTicket.ticket_number}
                  </p>
                  <Link to={`/tickets/${userTicket.id}`} className="btn btn-primary" style={{ width: '100%' }}>
                    View Full Ticket
                  </Link>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '0.375rem' }}>Ticket Price</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                      <span style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '2rem',
                        fontWeight: 900,
                        ...(event.price === 0 ? { color: 'var(--color-emerald)' } : {
                          background: 'var(--gradient-primary)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        })
                      }}>
                        {formatCurrency(event.price, event.currency)}
                      </span>
                      {event.price > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-3)' }}>per ticket</span>}
                    </div>
                  </div>

                  {event.price > 0 && (
                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                      <label className="form-label">Quantity</label>
                      <select
                        className="form-select"
                        value={quantity}
                        onChange={e => setQuantity(Number(e.target.value))}
                        id="ticket-quantity"
                      >
                        {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} ticket{n > 1 ? 's' : ''}</option>)}
                      </select>
                      {quantity > 1 && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-3)' }}>
                          Total: <strong style={{ color: 'var(--color-text)' }}>{formatCurrency(event.price * quantity, event.currency)}</strong>
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    className="btn btn-primary btn-lg"
                    style={{ width: '100%', marginBottom: '0.75rem' }}
                    onClick={handlePurchase}
                    disabled={isSoldOut || purchasing}
                    id="event-purchase-btn"
                  >
                    {purchasing ? <div className="spinner" /> : isSoldOut ? 'Sold Out' : event.price === 0 ? 'Register for Free' : `Pay ${formatCurrency(event.price * quantity, event.currency)}`}
                  </button>

                  {!user && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-text-3)', textAlign: 'center' }}>
                      <Link to="/auth" style={{ color: 'var(--color-primary-light)' }}>Sign in</Link> to purchase tickets
                    </p>
                  )}

                  {event.price > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
                      <img src="https://paystack.com/assets/img/paystack-icons/paystack-badge-new.svg" alt="Secured by Paystack" style={{ height: 20, opacity: 0.7 }} />
                    </div>
                  )}

                  <div className="divider" />
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-4)', textAlign: 'center', lineHeight: 1.6 }}>
                    📧 QR ticket sent to your email instantly after payment
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Checkout Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Complete Your Purchase</h2>
                <button className="modal-close" onClick={() => setShowModal(false)} id="modal-close">×</button>
              </div>
              <div className="modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{
                    background: 'var(--color-bg-3)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1rem',
                  }}>
                    <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>{event.title}</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-3)' }}>{formatDate(event.start_at)} · {formatTime(event.start_at)}</p>
                    <div className="divider" style={{ margin: '0.75rem 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span>{quantity} × {formatCurrency(event.price, event.currency)}</span>
                      <strong style={{ color: 'var(--color-primary-light)' }}>{formatCurrency(event.price * quantity, event.currency)}</strong>
                    </div>
                  </div>

                  <div className="alert alert-info">
                    <span style={{ fontSize: '0.85rem' }}>
                      You\'ll pay via Paystack. Supports OPay, all Nigerian banks, cards & USSD.
                    </span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handlePaystackPayment}
                  disabled={purchasing}
                  id="paystack-pay-btn"
                >
                  {purchasing ? <div className="spinner" /> : `Pay ${formatCurrency(event.price * quantity, event.currency)} via Paystack`}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
