import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, TrendingUp, Ticket, Users, DollarSign, Edit, Trash2, Eye, QrCode, Calendar, MapPin, ToggleLeft, ToggleRight, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatDate, formatTime, formatCurrency, EVENT_CATEGORIES } from '../lib/constants'
import toast from 'react-hot-toast'

const EMPTY_FORM = {
  title: '',
  description: '',
  category: 'General',
  event_type: 'physical',
  location: '',
  venue_name: '',
  online_link: '',
  start_at: '',
  end_at: '',
  price: 0,
  currency: 'NGN',
  capacity: 100,
  status: 'draft',
  tags: '',
}

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const [events, setEvents] = useState([])
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) { fetchEvents(); fetchAllTickets() }
  }, [user])

  const fetchEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('organizer_id', user.id)
      .order('created_at', { ascending: false })
    setEvents(data || [])
    setLoading(false)
  }

  const fetchAllTickets = async () => {
    const { data } = await supabase
      .from('tickets')
      .select('*, events!inner(organizer_id, title), profiles(full_name, email)')
      .eq('events.organizer_id', user.id)
      .order('created_at', { ascending: false })
    setTickets(data || [])
  }

  const publishedEvents = events.filter(e => e.status === 'published').length
  const totalTicketsSold = events.reduce((s, e) => s + (e.tickets_sold || 0), 0)
  const totalAttendees = tickets.length
  const totalRevenue = tickets
    .filter(t => t.status !== 'cancelled' && t.status !== 'refunded')
    .length

  const openCreateForm = () => {
    setEditingEvent(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEditForm = (event) => {
    setEditingEvent(event)
    setForm({
      title: event.title,
      description: event.description || '',
      category: event.category || 'General',
      event_type: event.event_type,
      location: event.location || '',
      venue_name: event.venue_name || '',
      online_link: event.online_link || '',
      start_at: event.start_at ? event.start_at.slice(0, 16) : '',
      end_at: event.end_at ? event.end_at.slice(0, 16) : '',
      price: event.price,
      currency: event.currency || 'NGN',
      capacity: event.capacity,
      status: event.status,
      tags: (event.tags || []).join(', '),
    })
    setShowForm(true)
  }

  const handleFormChange = (e) => {
    const { name, value, type } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }))
  }

  const handleSaveEvent = async (e) => {
    e.preventDefault()
    if (!form.title || !form.start_at) { toast.error('Title and start date are required'); return }
    setSaving(true)
    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        event_type: form.event_type,
        location: form.location || null,
        venue_name: form.venue_name || null,
        online_link: form.online_link || null,
        start_at: form.start_at,
        end_at: form.end_at || null,
        price: form.price,
        currency: form.currency,
        capacity: form.capacity,
        status: form.status,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        organizer_id: user.id,
      }

      let error
      if (editingEvent) {
        const { error: e } = await supabase.from('events').update(payload).eq('id', editingEvent.id)
        error = e
      } else {
        const { error: e } = await supabase.from('events').insert(payload)
        error = e
      }

      if (error) throw error
      toast.success(editingEvent ? 'Event updated!' : 'Event created! 🎉')
      setShowForm(false)
      fetchEvents()
    } catch (err) {
      toast.error(err.message || 'Failed to save event')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (event) => {
    const newStatus = event.status === 'published' ? 'draft' : 'published'
    const { error } = await supabase.from('events').update({ status: newStatus }).eq('id', event.id)
    if (!error) {
      toast.success(`Event ${newStatus === 'published' ? 'published! 🎉' : 'set to draft'}`)
      fetchEvents()
    }
  }

  const handleDeleteEvent = async (event) => {
    if (!confirm(`Delete "${event.title}"? This cannot be undone.`)) return
    const { error } = await supabase.from('events').delete().eq('id', event.id)
    if (!error) { toast.success('Event deleted'); fetchEvents() }
    else toast.error('Failed to delete event')
  }

  const STATS = [
    {
      icon: <TrendingUp size={20} />,
      value: publishedEvents,
      label: 'Live Events',
      color: 'var(--color-emerald)',
      bg: 'rgba(16,185,129,0.12)',
      change: `${events.length} total`,
      up: true,
    },
    {
      icon: <Ticket size={20} />,
      value: totalTicketsSold,
      label: 'Tickets Sold',
      color: 'var(--color-primary-light)',
      bg: 'rgba(124,58,237,0.12)',
      change: 'All time',
      up: true,
    },
    {
      icon: <Users size={20} />,
      value: totalAttendees,
      label: 'Attendees',
      color: 'var(--color-sky)',
      bg: 'rgba(14,165,233,0.12)',
      change: 'Registered',
      up: true,
    },
    {
      icon: <DollarSign size={20} />,
      value: totalRevenue,
      label: 'Confirmed',
      color: 'var(--color-gold)',
      bg: 'rgba(245,158,11,0.12)',
      change: 'Paid tickets',
      up: true,
    },
  ]

  return (
    <main className="page">
      <div className="page-header">
        <div className="container" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-header-title">Organizer Dashboard</h1>
            <p className="page-header-subtitle">
              Welcome back, {profile?.full_name?.split(' ')[0] || 'Organizer'}!
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/scanner" className="btn btn-secondary" id="dashboard-scanner-link">
              <QrCode size={15} /> QR Scanner
            </Link>
            <button className="btn btn-primary" onClick={openCreateForm} id="create-event-btn">
              <Plus size={15} /> Create Event
            </button>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: '4rem' }}>
        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: '2.5rem' }}>
          {STATS.map((s, i) => (
            <div key={i} className="stat-card">
              <div className="stat-card-icon" style={{ background: s.bg, color: s.color }}>
                {s.icon}
              </div>
              <div className="stat-card-value">
                {s.value.toLocaleString()}
              </div>
              <div className="stat-card-label">{s.label}</div>
              <div className={`stat-card-change ${s.up ? 'up' : 'down'}`}>
                ↑ {s.change}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {[
            { key: 'overview', label: 'My Events' },
            { key: 'attendees', label: `Attendees (${totalAttendees})` },
          ].map(t => (
            <button
              key={t.key}
              className={`filter-chip ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
              id={`dashboard-tab-${t.key}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Events list */}
        {tab === 'overview' && (
          <>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-xl)' }} />
                ))}
              </div>
            ) : events.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {events.map(event => (
                  <div
                    key={event.id}
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-xl)',
                      padding: '1.25rem 1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      flexWrap: 'wrap',
                      transition: 'all 0.2s',
                    }}
                    id={`dashboard-event-${event.id}`}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {event.title}
                        </h3>
                        <span className={`badge badge-${event.status === 'published' ? 'emerald' : event.status === 'cancelled' ? 'rose' : 'gray'}`}>
                          {event.status}
                        </span>
                        <span className="badge badge-sky">{event.event_type}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--color-text-3)' }}>
                          <Calendar size={12} /> {formatDate(event.start_at)}
                        </span>
                        {(event.venue_name || event.location) && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--color-text-3)' }}>
                            <MapPin size={12} /> {event.venue_name || event.location}
                          </span>
                        )}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--color-text-3)' }}>
                          <Ticket size={12} /> {event.tickets_sold || 0}/{event.capacity} sold
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-primary-light)', fontWeight: 600 }}>
                          {formatCurrency(event.price, event.currency)}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div style={{ marginTop: '0.625rem', height: 3, borderRadius: 4, background: 'var(--color-border)', overflow: 'hidden', maxWidth: 200 }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(100, ((event.tickets_sold || 0) / event.capacity) * 100)}%`,
                          background: 'var(--gradient-primary)',
                          borderRadius: 4,
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleToggleStatus(event)}
                        className={`btn btn-sm ${event.status === 'published' ? 'btn-secondary' : 'btn-primary'}`}
                      >
                        {event.status === 'published'
                          ? <><ToggleRight size={14} /> Unpublish</>
                          : <><ToggleLeft size={14} /> Publish</>
                        }
                      </button>
                      <Link to={`/events/${event.id}`} className="btn btn-sm btn-ghost" title="View public page">
                        <Eye size={14} />
                      </Link>
                      <button onClick={() => openEditForm(event)} className="btn btn-sm btn-ghost" title="Edit">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => handleDeleteEvent(event)} className="btn btn-sm btn-danger" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon"><Calendar size={28} /></div>
                <h3 className="empty-state-title">No events yet</h3>
                <p className="empty-state-text">Create your first event to start selling tickets.</p>
                <button className="btn btn-primary" onClick={openCreateForm} id="empty-create-event">
                  <Plus size={15} /> Create Your First Event
                </button>
              </div>
            )}
          </>
        )}

        {/* Attendees tab */}
        {tab === 'attendees' && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Attendee</th>
                  <th>Event</th>
                  <th>Ticket #</th>
                  <th>Status</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length > 0 ? tickets.slice(0, 100).map(ticket => (
                  <tr key={ticket.id}>
                    <td>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ticket.profiles?.full_name || 'Unknown'}</p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-3)' }}>{ticket.profiles?.email}</p>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ticket.events?.title || '—'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--color-text-3)' }}>
                      {ticket.ticket_number}
                    </td>
                    <td>
                      <span className={`badge badge-${ticket.status === 'active' ? 'emerald' : ticket.status === 'used' ? 'sky' : 'rose'}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>
                      {formatDate(ticket.created_at)}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-3)' }}>
                      No attendees yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Event Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div
            className="modal"
            style={{ maxWidth: 680 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">{editingEvent ? 'Edit Event' : 'Create New Event'}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)} id="event-form-close">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEvent}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                <div className="form-group">
                  <label className="form-label" htmlFor="event-title">Event Title *</label>
                  <input
                    id="event-title"
                    name="title"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Lagos Tech Summit 2026"
                    value={form.title}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="event-description">Description</label>
                  <textarea
                    id="event-description"
                    name="description"
                    className="form-textarea"
                    placeholder="Tell attendees what to expect..."
                    value={form.description}
                    onChange={handleFormChange}
                    rows={4}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="event-category">Category</label>
                    <select id="event-category" name="category" className="form-select" value={form.category} onChange={handleFormChange}>
                      {EVENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="event-type">Event Type</label>
                    <select id="event-type" name="event_type" className="form-select" value={form.event_type} onChange={handleFormChange}>
                      <option value="physical">📍 Physical</option>
                      <option value="online">🌐 Online</option>
                      <option value="hybrid">🎥 Hybrid (Physical + Online)</option>
                    </select>
                  </div>
                </div>

                {(form.event_type === 'physical' || form.event_type === 'hybrid') && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="event-venue">Venue Name</label>
                      <input id="event-venue" name="venue_name" type="text" className="form-input" placeholder="e.g. Eko Hotel & Suites" value={form.venue_name} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="event-location">City / Address</label>
                      <input id="event-location" name="location" type="text" className="form-input" placeholder="e.g. Lagos Island, Lagos" value={form.location} onChange={handleFormChange} />
                    </div>
                  </div>
                )}

                {(form.event_type === 'online' || form.event_type === 'hybrid') && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="event-online-link">Online Event Link</label>
                    <input id="event-online-link" name="online_link" type="url" className="form-input" placeholder="https://zoom.us/j/your-meeting-id" value={form.online_link} onChange={handleFormChange} />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="event-start">Start Date & Time *</label>
                    <input id="event-start" name="start_at" type="datetime-local" className="form-input" value={form.start_at} onChange={handleFormChange} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="event-end">End Date & Time</label>
                    <input id="event-end" name="end_at" type="datetime-local" className="form-input" value={form.end_at} onChange={handleFormChange} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="event-price">Price ({form.currency})</label>
                    <input id="event-price" name="price" type="number" min="0" step="100" className="form-input" placeholder="0 = Free" value={form.price} onChange={handleFormChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="event-currency">Currency</label>
                    <select id="event-currency" name="currency" className="form-select" value={form.currency} onChange={handleFormChange}>
                      <option value="NGN">NGN (₦)</option>
                      <option value="USD">USD ($)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="event-capacity">Capacity</label>
                    <input id="event-capacity" name="capacity" type="number" min="1" className="form-input" value={form.capacity} onChange={handleFormChange} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="event-tags">Tags <span style={{ color: 'var(--color-text-4)', fontWeight: 400 }}>(comma separated)</span></label>
                  <input id="event-tags" name="tags" type="text" className="form-input" placeholder="e.g. networking, startup, free food" value={form.tags} onChange={handleFormChange} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="event-status">Visibility</label>
                  <select id="event-status" name="status" className="form-select" value={form.status} onChange={handleFormChange}>
                    <option value="draft">🔒 Draft (only you can see)</option>
                    <option value="published">✅ Published (visible to everyone)</option>
                    <option value="cancelled">❌ Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving} id="event-form-save">
                  {saving ? <div className="spinner" /> : editingEvent ? 'Save Changes' : '🎉 Create Event'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
