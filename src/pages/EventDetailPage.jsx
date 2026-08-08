import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { MapPin, Calendar, Clock, Users, Globe, Share2, ArrowLeft, Wifi, CheckCircle, ExternalLink, X, MessageCircle, Navigation } from 'lucide-react'
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
  const [ticketTypes, setTicketTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [userTickets, setUserTickets] = useState([])
  const [selectedType, setSelectedType] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [checkoutName, setCheckoutName] = useState('')
  const [checkoutPhone, setCheckoutPhone] = useState('')

  useEffect(() => {
    fetchEvent()
    if (user) checkUserTickets()
  }, [id, user])

  const fetchEvent = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*, profiles(full_name, avatar_url)')
      .eq('id', id)
      .single()
    if (error || !data) { navigate('/events'); return }
    setEvent(data)

    // Fetch ticket types
    const { data: types } = await supabase
      .from('ticket_types')
      .select('*')
      .eq('event_id', id)
      .order('sort_order')
    if (types && types.length > 0) {
      setTicketTypes(types)
      setSelectedType(types[0])
    } else {
      // Fallback: create a virtual ticket type from event price/capacity
      const fallback = [{
        id: 'fallback',
        name: 'General Admission',
        price: data.price || 0,
        quantity: data.capacity || 100,
        quantity_sold: data.tickets_sold || 0,
      }]
      setTicketTypes(fallback)
      setSelectedType(fallback[0])
    }
    setLoading(false)
  }

  const checkUserTickets = async () => {
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .eq('event_id', id)
      .eq('attendee_id', user.id)
      .neq('status', 'cancelled')
    setUserTickets(data || [])
  }

  const handlePurchase = () => {
    if (!user) { navigate('/auth'); return }
    if (!selectedType) { toast.error('Please select a ticket type'); return }
    // Pre-fill name from profile
    setCheckoutName(profile?.full_name || '')
    setCheckoutPhone('')
    if (selectedType.price === 0) {
      createTickets(0, null)
    } else {
      setShowModal(true)
    }
  }

  const createTickets = async (amountPaid, paystackRef, ticketTypeName) => {
    setPurchasing(true)
    try {
      const tType = selectedType
      const qty = quantity
      const createdTickets = []

      for (let i = 0; i < qty; i++) {
        const { data: ticket, error } = await supabase
          .from('tickets')
          .insert({
            event_id: event.id,
            attendee_id: user.id,
            ticket_type_id: tType.id !== 'fallback' ? tType.id : null,
            ticket_type_name: tType.name,
            amount_paid: amountPaid / qty,
            attendee_name: checkoutName || profile?.full_name || null,
            attendee_phone: checkoutPhone || null,
          })
          .select()
          .single()
        if (error) throw error
        createdTickets.push(ticket)
      }

      // Create order record
      await supabase.from('orders').insert({
        ticket_id: createdTickets[0].id,
        attendee_id: user.id,
        event_id: event.id,
        amount: amountPaid,
        currency: event.currency || 'NGN',
        payment_status: 'completed',
        paystack_reference: paystackRef || null,
        payment_method: paystackRef ? 'paystack' : 'free',
      })

      // Update ticket_type quantity_sold
      if (tType.id !== 'fallback') {
        await supabase
          .from('ticket_types')
          .update({ quantity_sold: (tType.quantity_sold || 0) + qty })
          .eq('id', tType.id)
      }

      await checkUserTickets()
      setShowModal(false)
      toast.success(amountPaid === 0 ? 'Free ticket registered! 🎉' : `${qty} ticket${qty > 1 ? 's' : ''} purchased! 🎉`)
    } catch (err) {
      toast.error(err.message || 'Failed to create ticket')
    } finally {
      setPurchasing(false)
    }
  }

  const handlePaystackPayment = () => {
    if (!checkoutName.trim()) { toast.error('Please enter your full name'); return }
    const totalAmount = selectedType.price * quantity
    const ref = generateReference('TW')
    initializePaystack({
      email: user.email,
      amount: totalAmount,
      reference: ref,
      currency: event.currency || 'NGN',
      metadata: {
        'Event': event.title,
        'Attendee': checkoutName,
        'Phone': checkoutPhone,
        'Ticket Type': selectedType.name,
        'Quantity': quantity,
      },
      onSuccess: async (response) => {
        await createTickets(totalAmount, response.reference)
      },
      onClose: () => toast('Payment cancelled', { icon: '⚠️' }),
    })
  }

  const handleShare = async () => {
    try {
      await navigator.share({ title: event.title, text: `Check out this event: ${event.title}`, url: window.location.href })
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
              <div className="skeleton" style={{ height: 360, borderRadius: 'var(--radius-xl)' }} />
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (!event) return null

  const primaryTicket = userTickets[0] || null
  const totalSold = ticketTypes.reduce((s, t) => s + (t.quantity_sold || 0), 0)
  const totalCap = ticketTypes.reduce((s, t) => s + (t.quantity || 0), 0) || event.capacity
  const availableForSelected = selectedType ? (selectedType.quantity - (selectedType.quantity_sold || 0)) : 0
  const isSoldOut = selectedType ? availableForSelected <= 0 : totalSold >= totalCap
  const percentSold = Math.round((totalSold / totalCap) * 100)

  return (
    <main className="page">
      <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '4rem' }}>
        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm" style={{ marginBottom: '1.5rem' }} id="event-detail-back">
          <ArrowLeft size={15} /> Back
        </button>

        {/* Banner */}
        <div style={{ width: '100%', height: 360, borderRadius: 'var(--radius-2xl)', overflow: 'hidden', marginBottom: '2rem', position: 'relative', background: 'linear-gradient(135deg, #1a1a2e, #2d1b69)' }}>
          {event.banner_url && <img src={event.banner_url} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(9,9,15,0.7) 0%, transparent 60%)' }} />
          <div style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem', display: 'flex', gap: '0.5rem' }}>
            <span className={`badge badge-${event.event_type === 'online' ? 'emerald' : 'sky'}`}>
              {event.event_type === 'online' ? <Wifi size={10} /> : <Globe size={10} />} {getEventTypeLabel(event.event_type)}
            </span>
            <span className="badge badge-gray">{event.category}</span>
          </div>
          <button onClick={handleShare} className="btn btn-sm" style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(9,9,15,0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} id="event-share">
            <Share2 size={14} /> Share
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem', alignItems: 'start' }}>
          {/* Left */}
          <div className="fade-in">
            <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>{event.title}</h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-3)', marginBottom: '1.5rem' }}>
              Organized by <span style={{ color: 'var(--color-text-2)', fontWeight: 600 }}>{event.profiles?.full_name || 'Unknown'}</span>
            </p>

            {/* Meta grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary-light)', marginBottom: '0.375rem' }}>
                  <Calendar size={15} /><span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</span>
                </div>
                <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{formatDate(event.start_at)}</p>
                {event.end_at && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-3)' }}>to {formatDate(event.end_at)}</p>}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary-light)', marginBottom: '0.375rem' }}>
                  <Clock size={15} /><span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time</span>
                </div>
                <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{formatTime(event.start_at)}</p>
              </div>
              {event.location && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary-light)', marginBottom: '0.375rem' }}>
                    <MapPin size={15} /><span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location</span>
                  </div>
                  <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{event.venue_name || event.location}</p>
                  {event.venue_name && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-3)' }}>{event.location}</p>}
                </div>
              )}
              {event.online_link && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-emerald)', marginBottom: '0.375rem' }}>
                    <Globe size={15} /><span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Online Link</span>
                  </div>
                  <a href={event.online_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-emerald)', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {primaryTicket ? 'Join Event' : 'After ticket purchase'} {primaryTicket && <ExternalLink size={12} />}
                  </a>
                </div>
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary-light)', marginBottom: '0.375rem' }}>
                  <Users size={15} /><span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Capacity</span>
                </div>
                <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{totalCap - totalSold} spots left</p>
                <div style={{ marginTop: '0.375rem', height: 4, borderRadius: 4, background: 'var(--color-border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${percentSold}%`, background: percentSold > 80 ? 'var(--color-rose)' : 'var(--gradient-primary)', borderRadius: 4 }} />
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-4)', marginTop: '0.25rem' }}>{percentSold}% filled</p>
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>About this Event</h2>
              <div style={{ color: 'var(--color-text-2)', lineHeight: 1.8, fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
                {event.description || 'No description provided.'}
              </div>
            </div>

            {/* Tags */}
            {event.tags?.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                {event.tags.map(tag => <span key={tag} className="badge badge-primary">#{tag}</span>)}
              </div>
            )}

            {/* Map — physical/hybrid events with a location */}
            {(event.event_type === 'physical' || event.event_type === 'hybrid') && (event.venue_name || event.location) && (
              <div style={{ marginTop: '0.5rem' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Location</h2>
                <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--color-border)', marginBottom: '0.875rem', height: 260, position: 'relative', background: 'var(--color-bg-3)' }}>
                  <iframe
                    title="Event location map"
                    width="100%"
                    height="100%"
                    style={{ border: 0, display: 'block', filter: 'invert(90%) hue-rotate(180deg)' }}
                    loading="lazy"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent([event.venue_name, event.location].filter(Boolean).join(', '))}&output=embed&z=15`}
                    allowFullScreen
                  />
                </div>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent([event.venue_name, event.location].filter(Boolean).join(', '))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  id="get-directions-btn"
                >
                  <Navigation size={14} /> Get Directions
                </a>
              </div>
            )}
          </div>

          {/* Right: Purchase card */}
          <div style={{ position: 'sticky', top: '88px' }}>
            <div className="card" style={{ padding: '1.75rem' }}>
              {primaryTicket ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: 'var(--color-emerald)' }}>
                    <CheckCircle size={24} />
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '0.25rem' }}>You're In!</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-primary-light)', fontWeight: 600, marginBottom: '0.75rem' }}>{primaryTicket.ticket_type_name || 'General Admission'}</p>
                  <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1.25rem', display: 'inline-block' }}>
                    <QRCodeSVG value={JSON.stringify({ ticketId: primaryTicket.id, eventId: event.id, qrCode: primaryTicket.qr_code })} size={140} fgColor="#09090f" />
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-4)', fontFamily: 'monospace', marginBottom: '1.25rem' }}>{primaryTicket.ticket_number}</p>
                  <Link to={`/tickets/${primaryTicket.id}`} className="btn btn-primary" style={{ width: '100%' }}>View Full Ticket</Link>
                  {/* WhatsApp share */}
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`I just got my ticket for "${event.title}"! 🎟️ Join me:\n${window.location.href}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                    style={{ width: '100%', marginTop: '0.5rem', color: '#25D366', borderColor: 'rgba(37,211,102,0.3)' }}
                    id="whatsapp-share-btn"
                  >
                    <MessageCircle size={14} /> Share on WhatsApp
                  </a>
                  {userTickets.length > 1 && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-text-3)', marginTop: '0.75rem' }}>+{userTickets.length - 1} more ticket{userTickets.length > 2 ? 's' : ''} — <Link to="/tickets" style={{ color: 'var(--color-primary-light)' }}>View all</Link></p>
                  )}
                </div>
              ) : (
                <>
                  {/* Ticket type selector */}
                  {ticketTypes.length > 1 && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <p style={{ fontSize: '0.78rem', color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '0.625rem' }}>Select Ticket Type</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {ticketTypes.map(tt => {
                          const avail = tt.quantity - (tt.quantity_sold || 0)
                          const isSelected = selectedType?.id === tt.id
                          return (
                            <button
                              key={tt.id}
                              onClick={() => avail > 0 && setSelectedType(tt)}
                              disabled={avail <= 0}
                              style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '0.75rem 1rem',
                                background: isSelected ? 'rgba(124,58,237,0.12)' : 'var(--color-bg-3)',
                                border: `1px solid ${isSelected ? 'rgba(124,58,237,0.4)' : 'var(--color-border)'}`,
                                borderRadius: 'var(--radius-lg)',
                                cursor: avail > 0 ? 'pointer' : 'not-allowed',
                                opacity: avail <= 0 ? 0.5 : 1,
                                textAlign: 'left',
                                transition: 'all 0.15s',
                              }}
                              id={`ticket-type-btn-${tt.id}`}
                            >
                              <div>
                                <p style={{ fontWeight: 700, fontSize: '0.88rem' }}>{tt.name}</p>
                                {tt.description && <p style={{ fontSize: '0.74rem', color: 'var(--color-text-3)', marginTop: '0.125rem' }}>{tt.description}</p>}
                                <p style={{ fontSize: '0.74rem', color: 'var(--color-text-4)', marginTop: '0.125rem' }}>{avail > 0 ? `${avail} left` : 'Sold out'}</p>
                              </div>
                              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.1rem', ...(tt.price === 0 ? { color: 'var(--color-emerald)' } : { background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }) }}>
                                {formatCurrency(tt.price, event.currency)}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Single type display */}
                  {ticketTypes.length === 1 && selectedType && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <p style={{ fontSize: '0.78rem', color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '0.375rem' }}>
                        {selectedType.name}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 900, ...(selectedType.price === 0 ? { color: 'var(--color-emerald)' } : { background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }) }}>
                          {formatCurrency(selectedType.price, event.currency)}
                        </span>
                        {selectedType.price > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-3)' }}>per ticket</span>}
                      </div>
                    </div>
                  )}

                  {/* Quantity */}
                  {selectedType && selectedType.price > 0 && (
                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                      <label className="form-label">Quantity</label>
                      <select className="form-select" value={quantity} onChange={e => setQuantity(Number(e.target.value))} id="ticket-quantity">
                        {[1, 2, 3, 4, 5].filter(n => n <= availableForSelected).map(n => (
                          <option key={n} value={n}>{n} ticket{n > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                      {quantity > 1 && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-3)', marginTop: '0.375rem' }}>
                          Total: <strong style={{ color: 'var(--color-text)' }}>{formatCurrency(selectedType.price * quantity, event.currency)}</strong>
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    className="btn btn-primary btn-lg"
                    style={{ width: '100%', marginBottom: '0.75rem' }}
                    onClick={handlePurchase}
                    disabled={isSoldOut || purchasing || !selectedType}
                    id="event-purchase-btn"
                  >
                    {purchasing ? <div className="spinner" /> : isSoldOut ? 'Sold Out' : !selectedType ? 'Select ticket type' : selectedType.price === 0 ? 'Register for Free' : `Pay ${formatCurrency(selectedType.price * quantity, event.currency)}`}
                  </button>

                  {!user && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-text-3)', textAlign: 'center' }}>
                      <Link to="/auth" style={{ color: 'var(--color-primary-light)' }}>Sign in</Link> to purchase tickets
                    </p>
                  )}

                  {selectedType && selectedType.price > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
                      <img src="https://paystack.com/assets/img/paystack-icons/paystack-badge-new.svg" alt="Secured by Paystack" style={{ height: 20, opacity: 0.7 }} />
                    </div>
                  )}

                  <div style={{ margin: '1rem 0', height: 1, background: 'var(--color-border)' }} />
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-4)', textAlign: 'center', lineHeight: 1.6 }}>
                    📧 QR ticket available instantly in-app after payment
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Checkout Modal */}
        {showModal && selectedType && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Complete Your Purchase</h2>
                <button className="modal-close" onClick={() => setShowModal(false)} id="modal-close"><X size={18} /></button>
              </div>
              <div className="modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Order summary */}
                  <div style={{ background: 'var(--color-bg-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
                    <p style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{event.title}</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--color-text-3)' }}>{selectedType.name} · {formatDate(event.start_at)}</p>
                    <div style={{ margin: '0.75rem 0', height: 1, background: 'var(--color-border)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span>{quantity} × {formatCurrency(selectedType.price, event.currency)}</span>
                      <strong style={{ color: 'var(--color-primary-light)' }}>{formatCurrency(selectedType.price * quantity, event.currency)}</strong>
                    </div>
                  </div>

                  {/* Attendee details */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="checkout-name">Full Name *</label>
                    <input id="checkout-name" type="text" className="form-input" placeholder="Your full name" value={checkoutName} onChange={e => setCheckoutName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="checkout-email">Email</label>
                    <input id="checkout-email" type="email" className="form-input" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="checkout-phone">Phone Number</label>
                    <input id="checkout-phone" type="tel" className="form-input" placeholder="+234 800 000 0000" value={checkoutPhone} onChange={e => setCheckoutPhone(e.target.value)} />
                  </div>

                  <div className="alert alert-info">
                    <span style={{ fontSize: '0.85rem' }}>You'll pay via Paystack. Supports card, bank transfer, OPay & USSD.</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-primary btn-lg" onClick={handlePaystackPayment} disabled={purchasing} id="paystack-pay-btn">
                  {purchasing ? <div className="spinner" /> : `Pay ${formatCurrency(selectedType.price * quantity, event.currency)} via Paystack`}
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
