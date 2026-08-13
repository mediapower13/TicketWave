import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, TrendingUp, Ticket, Users, DollarSign, Edit, Trash2, Eye,
  QrCode, Calendar, MapPin, ToggleLeft, ToggleRight, X, Download,
  Image, PlusCircle, MinusCircle, ChevronDown, ChevronUp, BarChart2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatDate, formatCurrency, EVENT_CATEGORIES } from '../lib/constants'
import toast from 'react-hot-toast'

const EMPTY_TICKET_TYPE = { name: '', price: 0, quantity: 100, description: '' }

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
  banner_url: '',
  currency: 'NGN',
  capacity: 100,
  status: 'draft',
  tags: '',
}

function exportToCSV(tickets, filename) {
  const headers = ['Name', 'Email', 'Phone', 'Event', 'Ticket #', 'Ticket Type', 'Amount Paid', 'Status', 'Date']
  const rows = tickets.map(t => [
    t.attendee_name || t.profiles?.full_name || '',
    t.profiles?.email || '',
    t.attendee_phone || '',
    t.events?.title || '',
    t.ticket_number || '',
    t.ticket_type_name || 'General',
    t.amount_paid != null ? t.amount_paid : '',
    t.status || '',
    t.created_at ? new Date(t.created_at).toLocaleString('en-NG') : '',
  ])
  const csvContent = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
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
  const [ticketTypes, setTicketTypes] = useState([{ ...EMPTY_TICKET_TYPE, name: 'General Admission' }])
  const [saving, setSaving] = useState(false)
  const [expandedEvent, setExpandedEvent] = useState(null)
  const [filterEventId, setFilterEventId] = useState('')

  useEffect(() => {
    if (user) { fetchEvents(); fetchAllTickets() }
  }, [user])

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, ticket_types(id, name, price, quantity, quantity_sold)')
        .eq('organizer_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setEvents(data || [])
    } catch (err) {
      // ticket_types table may not exist yet — fallback to events without types
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('organizer_id', user.id)
        .order('created_at', { ascending: false })
      setEvents((data || []).map(e => ({ ...e, ticket_types: [] })))
    }
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

  // Stats
  const publishedEvents = events.filter(e => e.status === 'published').length
  const totalTicketsSold = tickets.filter(t => t.status !== 'cancelled').length
  const totalRevenue = tickets
    .filter(t => t.status !== 'cancelled' && t.status !== 'refunded' && t.amount_paid != null)
    .reduce((sum, t) => sum + (Number(t.amount_paid) || 0), 0)
  const totalAttendees = tickets.filter(t => t.status === 'used').length

  const openCreateForm = () => {
    setEditingEvent(null)
    setForm(EMPTY_FORM)
    setTicketTypes([{ ...EMPTY_TICKET_TYPE, name: 'General Admission' }])
    setShowForm(true)
  }

  const openEditForm = async (event) => {
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
      banner_url: event.banner_url || '',
      currency: event.currency || 'NGN',
      capacity: event.capacity,
      status: event.status,
      tags: (event.tags || []).join(', '),
    })
    // Load existing ticket types
    const { data: types } = await supabase.from('ticket_types').select('*').eq('event_id', event.id).order('sort_order')
    setTicketTypes(types && types.length > 0 ? types : [{ ...EMPTY_TICKET_TYPE, name: 'General Admission' }])
    setShowForm(true)
  }

  const handleFormChange = (e) => {
    const { name, value, type } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }))
  }

  const updateTicketType = (idx, field, value) => {
    setTicketTypes(prev => prev.map((t, i) => i === idx ? { ...t, [field]: field === 'price' || field === 'quantity' ? Number(value) : value } : t))
  }
  const addTicketType = () => setTicketTypes(prev => [...prev, { ...EMPTY_TICKET_TYPE }])
  const removeTicketType = (idx) => setTicketTypes(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)

  const handleSaveEvent = async (e) => {
    e.preventDefault()
    if (!form.title || !form.start_at) { toast.error('Title and start date are required'); return }
    if (ticketTypes.some(t => !t.name)) { toast.error('All ticket types need a name'); return }
    setSaving(true)
    try {
      const totalCapacity = ticketTypes.reduce((s, t) => s + (Number(t.quantity) || 0), 0)
      const lowestPrice = Math.min(...ticketTypes.map(t => Number(t.price) || 0))

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
        banner_url: form.banner_url || null,
        price: lowestPrice,
        currency: form.currency,
        capacity: totalCapacity || form.capacity,
        status: form.status,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        organizer_id: user.id,
      }

      let eventId = editingEvent?.id
      if (editingEvent) {
        const { error } = await supabase.from('events').update(payload).eq('id', eventId)
        if (error) throw error
        // Delete old ticket types and re-insert
        await supabase.from('ticket_types').delete().eq('event_id', eventId)
      } else {
        const { data, error } = await supabase.from('events').insert(payload).select().single()
        if (error) throw error
        eventId = data.id
      }

      // Insert ticket types (only if ticket_types table exists)
      const typePayload = ticketTypes.map((t, i) => ({
        event_id: eventId,
        name: t.name,
        description: t.description || null,
        price: Number(t.price) || 0,
        quantity: Number(t.quantity) || 100,
        quantity_sold: t.quantity_sold || 0,
        sort_order: i,
      }))
      try {
        const { error: typeError } = await supabase.from('ticket_types').insert(typePayload)
        if (typeError) {
          console.warn('ticket_types insert failed (run SQL migration):', typeError.message)
          toast('Event saved! Run the SQL migration to enable ticket types.', { icon: '⚠️' })
        }
      } catch (typeErr) {
        console.warn('ticket_types table missing:', typeErr.message)
      }

      toast.success(editingEvent ? 'Event updated! ✅' : 'Event created! 🎉')
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
    if (!error) { toast.success(`Event ${newStatus === 'published' ? 'published! 🎉' : 'set to draft'}`); fetchEvents() }
  }

  const handleDeleteEvent = async (event) => {
    if (!confirm(`Delete "${event.title}"? This cannot be undone.`)) return
    const { error } = await supabase.from('events').delete().eq('id', event.id)
    if (!error) { toast.success('Event deleted'); fetchEvents() }
    else toast.error('Failed to delete event')
  }

  const filteredTickets = filterEventId ? tickets.filter(t => t.event_id === filterEventId) : tickets

  const STATS = [
    { icon: <TrendingUp size={20} />, value: publishedEvents, label: 'Live Events', color: 'var(--color-emerald)', bg: 'rgba(16,185,129,0.12)', sub: `${events.length} total` },
    { icon: <Ticket size={20} />, value: totalTicketsSold.toLocaleString(), label: 'Tickets Sold', color: 'var(--color-primary-light)', bg: 'rgba(124,58,237,0.12)', sub: 'All time' },
    { icon: <Users size={20} />, value: totalAttendees, label: 'Checked In', color: 'var(--color-sky)', bg: 'rgba(14,165,233,0.12)', sub: 'At door' },
    { icon: <DollarSign size={20} />, value: `₦${totalRevenue.toLocaleString('en-NG')}`, label: 'Total Revenue', color: 'var(--color-gold)', bg: 'rgba(245,158,11,0.12)', sub: 'Paid tickets' },
  ]

  return (
    <main className="page">
      <div className="page-header">
        <div className="container" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-header-title">Organizer Dashboard</h1>
            <p className="page-header-subtitle">Welcome back, {profile?.full_name?.split(' ')[0] || 'Organizer'}!</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/scanner" className="btn btn-secondary" id="dashboard-scanner-link"><QrCode size={15} /> QR Scanner</Link>
            <button className="btn btn-primary" onClick={openCreateForm} id="create-event-btn"><Plus size={15} /> Create Event</button>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: '4rem' }}>
        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: '2.5rem' }}>
          {STATS.map((s, i) => (
            <div key={i} className="stat-card">
              <div className="stat-card-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
              <div className="stat-card-value">{s.value}</div>
              <div className="stat-card-label">{s.label}</div>
              <div className="stat-card-change up">↑ {s.sub}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {[
            { key: 'overview', label: 'My Events' },
            { key: 'attendees', label: `Attendees (${tickets.length})` },
            { key: 'analytics', label: '📊 Analytics' },
          ].map(t => (
            <button key={t.key} className={`filter-chip ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)} id={`dashboard-tab-${t.key}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* My Events Tab */}
        {tab === 'overview' && (
          <>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-xl)' }} />)}
              </div>
            ) : events.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {events.map(event => {
                  const types = event.ticket_types || []
                  const totalSold = types.reduce((s, t) => s + (t.quantity_sold || 0), 0)
                  const totalCap = types.reduce((s, t) => s + (t.quantity || 0), 0) || event.capacity
                  const pct = Math.min(100, (totalSold / totalCap) * 100)
                  const isExpanded = expandedEvent === event.id

                  return (
                    <div key={event.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }} id={`dashboard-event-${event.id}`}>
                      <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        {/* Banner thumb */}
                        {event.banner_url && (
                          <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0 }}>
                            <img src={event.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</h3>
                            <span className={`badge badge-${event.status === 'published' ? 'emerald' : event.status === 'cancelled' ? 'rose' : 'gray'}`}>{event.status}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--color-text-3)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><Calendar size={12} />{formatDate(event.start_at)}</span>
                            {(event.venue_name || event.location) && <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><MapPin size={12} />{event.venue_name || event.location}</span>}
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><Ticket size={12} />{totalSold}/{totalCap} sold</span>
                            {types.length > 0 && (
                              <span style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>
                                {types.length === 1 ? formatCurrency(types[0].price, event.currency) : `From ${formatCurrency(Math.min(...types.map(t => t.price)), event.currency)}`}
                              </span>
                            )}
                          </div>
                          <div style={{ marginTop: '0.625rem', height: 3, borderRadius: 4, background: 'var(--color-border)', overflow: 'hidden', maxWidth: 200 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gradient-primary)', borderRadius: 4, transition: 'width 0.5s ease' }} />
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                          <button onClick={() => setExpandedEvent(isExpanded ? null : event.id)} className="btn btn-sm btn-ghost" title="View ticket types">
                            <BarChart2 size={14} /> {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                          <button onClick={() => handleToggleStatus(event)} className={`btn btn-sm ${event.status === 'published' ? 'btn-secondary' : 'btn-primary'}`}>
                            {event.status === 'published' ? <><ToggleRight size={14} /> Unpublish</> : <><ToggleLeft size={14} /> Publish</>}
                          </button>
                          <Link to={`/events/${event.id}`} className="btn btn-sm btn-ghost" title="View public page"><Eye size={14} /></Link>
                          <button onClick={() => openEditForm(event)} className="btn btn-sm btn-ghost" title="Edit"><Edit size={14} /></button>
                          <button onClick={() => handleDeleteEvent(event)} className="btn btn-sm btn-danger" title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </div>

                      {/* Ticket types breakdown */}
                      {isExpanded && types.length > 0 && (
                        <div style={{ borderTop: '1px solid var(--color-border)', padding: '1rem 1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                          {types.map(tt => (
                            <div key={tt.id} style={{ background: 'var(--color-bg-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.625rem 1rem', minWidth: 140 }}>
                              <p style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.25rem' }}>{tt.name}</p>
                              <p style={{ fontSize: '0.78rem', color: 'var(--color-primary-light)', fontWeight: 600 }}>{formatCurrency(tt.price, event.currency)}</p>
                              <p style={{ fontSize: '0.72rem', color: 'var(--color-text-3)', marginTop: '0.25rem' }}>{tt.quantity_sold || 0}/{tt.quantity} sold</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon"><Calendar size={28} /></div>
                <h3 className="empty-state-title">No events yet</h3>
                <p className="empty-state-text">Create your first event to start selling tickets.</p>
                <button className="btn btn-primary" onClick={openCreateForm} id="empty-create-event"><Plus size={15} /> Create Your First Event</button>
              </div>
            )}
          </>
        )}

        {/* Attendees Tab */}
        {tab === 'attendees' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <select className="form-select" style={{ maxWidth: 280 }} value={filterEventId} onChange={e => setFilterEventId(e.target.value)} id="attendees-event-filter">
                <option value="">All Events</option>
                {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
              <button
                className="btn btn-secondary"
                onClick={() => exportToCSV(filteredTickets, `attendees-${filterEventId ? events.find(e => e.id === filterEventId)?.title : 'all'}-${new Date().toISOString().slice(0, 10)}.csv`)}
                id="export-csv-btn"
              >
                <Download size={15} /> Export CSV
              </button>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Attendee</th>
                    <th>Event</th>
                    <th>Ticket Type</th>
                    <th>Ticket #</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.length > 0 ? filteredTickets.slice(0, 200).map(ticket => (
                    <tr key={ticket.id}>
                      <td>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ticket.attendee_name || ticket.profiles?.full_name || 'Unknown'}</p>
                          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-3)' }}>{ticket.attendee_phone || ticket.profiles?.email}</p>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.85rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.events?.title || '—'}</td>
                      <td><span className="badge badge-primary">{ticket.ticket_type_name || 'General'}</span></td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--color-text-3)' }}>{ticket.ticket_number}</td>
                      <td style={{ fontWeight: 600, color: 'var(--color-primary-light)', whiteSpace: 'nowrap' }}>
                        {ticket.amount_paid != null ? formatCurrency(ticket.amount_paid) : '—'}
                      </td>
                      <td><span className={`badge badge-${ticket.status === 'active' ? 'emerald' : ticket.status === 'used' ? 'sky' : 'rose'}`}>{ticket.status}</span></td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>{formatDate(ticket.created_at)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-3)' }}>No attendees yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {tab === 'analytics' && (() => {
          const validTickets = tickets.filter(t => t.status !== 'cancelled' && t.status !== 'refunded')

          // Revenue by event (top 6)
          const revenueByEvent = events.map(e => ({
            name: e.title.length > 28 ? e.title.slice(0, 28) + '…' : e.title,
            revenue: validTickets.filter(t => t.event_id === e.id && t.amount_paid != null).reduce((s, t) => s + Number(t.amount_paid || 0), 0),
            sold: validTickets.filter(t => t.event_id === e.id).length,
          })).filter(e => e.revenue > 0 || e.sold > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 6)
          const maxRevenue = Math.max(...revenueByEvent.map(e => e.revenue), 1)

          // Ticket type breakdown
          const byType = {}
          validTickets.forEach(t => { const k = t.ticket_type_name || 'General'; byType[k] = (byType[k] || 0) + 1 })
          const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1])
          const maxTypeCount = Math.max(...typeEntries.map(e => e[1]), 1)

          // Daily sales — last 14 days
          const days = Array.from({ length: 14 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (13 - i)); return d.toISOString().slice(0, 10)
          })
          const dailySales = days.map(day => ({
            label: new Date(day).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
            count: validTickets.filter(t => t.created_at?.slice(0, 10) === day).length,
            revenue: validTickets.filter(t => t.created_at?.slice(0, 10) === day && t.amount_paid != null).reduce((s, t) => s + Number(t.amount_paid || 0), 0),
          }))
          const maxDailyRev = Math.max(...dailySales.map(d => d.revenue), 1)
          const COLORS = ['var(--color-primary-light)', 'var(--color-emerald)', 'var(--color-sky)', 'var(--color-gold)', 'var(--color-rose)', '#a78bfa']

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

              {/* Daily Revenue — last 14 days */}
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem' }}>Revenue — Last 14 Days</h3>
                {dailySales.every(d => d.revenue === 0) ? (
                  <p style={{ color: 'var(--color-text-4)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>No sales data yet — start selling tickets to see analytics!</p>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: 120, overflow: 'hidden' }}>
                    {dailySales.map((d, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                        <div
                          title={`${d.label}: ₦${d.revenue.toLocaleString('en-NG')} (${d.count} tickets)`}
                          style={{
                            width: '100%',
                            height: `${Math.max(4, (d.revenue / maxDailyRev) * 100)}%`,
                            background: d.revenue > 0 ? 'var(--gradient-primary)' : 'var(--color-border)',
                            borderRadius: '3px 3px 0 0',
                            transition: 'height 0.4s ease',
                            cursor: 'default',
                          }}
                        />
                        <span style={{ fontSize: '0.6rem', color: 'var(--color-text-4)', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 36, textAlign: 'center' }}>{d.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Revenue by Event */}
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem' }}>Revenue by Event</h3>
                  {revenueByEvent.length === 0 ? (
                    <p style={{ color: 'var(--color-text-4)', fontSize: '0.85rem' }}>No revenue data yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                      {revenueByEvent.map((e, i) => (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-2)', fontWeight: 500 }}>{e.name}</span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary-light)' }}>₦{e.revenue.toLocaleString('en-NG')}</span>
                          </div>
                          <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(e.revenue / maxRevenue) * 100}%`, background: COLORS[i % COLORS.length], borderRadius: 3, transition: 'width 0.5s ease' }} />
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-4)' }}>{e.sold} ticket{e.sold !== 1 ? 's' : ''} sold</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ticket Type Breakdown */}
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem' }}>Ticket Type Sales</h3>
                  {typeEntries.length === 0 ? (
                    <p style={{ color: 'var(--color-text-4)', fontSize: '0.85rem' }}>No tickets sold yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                      {typeEntries.map(([name, count], i) => (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-2)', fontWeight: 500 }}>{name}</span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: COLORS[i % COLORS.length] }}>{count} sold</span>
                          </div>
                          <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(count / maxTypeCount) * 100}%`, background: COLORS[i % COLORS.length], borderRadius: 3, transition: 'width 0.5s ease' }} />
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-4)' }}>{Math.round((count / validTickets.length) * 100)}% of total</span>
                        </div>
                      ))}
                      <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-3)' }}>Total tickets</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{validTickets.length}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {[
                  { label: 'Avg. Ticket Price', value: validTickets.filter(t => t.amount_paid > 0).length > 0 ? `₦${Math.round(totalRevenue / validTickets.filter(t => t.amount_paid > 0).length).toLocaleString('en-NG')}` : '—' },
                  { label: 'Free Tickets', value: validTickets.filter(t => !t.amount_paid || t.amount_paid === 0).length },
                  { label: 'Check-in Rate', value: tickets.length > 0 ? `${Math.round((tickets.filter(t => t.status === 'used').length / tickets.length) * 100)}%` : '—' },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--color-primary-light)', marginBottom: '0.25rem' }}>{s.value}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-3)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Create / Edit Event Modal */}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingEvent ? 'Edit Event' : 'Create New Event'}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)} id="event-form-close"><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveEvent}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                <div className="form-group">
                  <label className="form-label" htmlFor="event-title">Event Title *</label>
                  <input id="event-title" name="title" type="text" className="form-input" placeholder="e.g. Lagos Tech Summit 2026" value={form.title} onChange={handleFormChange} required />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="event-description">Description</label>
                  <textarea id="event-description" name="description" className="form-textarea" placeholder="Tell attendees what to expect..." value={form.description} onChange={handleFormChange} rows={3} />
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
                      <option value="hybrid">🎥 Hybrid</option>
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
                    <input id="event-online-link" name="online_link" type="url" className="form-input" placeholder="https://zoom.us/j/..." value={form.online_link} onChange={handleFormChange} />
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

                <div className="form-group">
                  <label className="form-label" htmlFor="event-banner"><Image size={13} style={{ display: 'inline', marginRight: 4 }} />Banner Image URL</label>
                  <input id="event-banner" name="banner_url" type="url" className="form-input" placeholder="https://... (paste a direct image link)" value={form.banner_url} onChange={handleFormChange} />
                  {form.banner_url && (
                    <div style={{ marginTop: '0.5rem', borderRadius: 'var(--radius-md)', overflow: 'hidden', height: 80 }}>
                      <img src={form.banner_url} alt="Banner preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                    </div>
                  )}
                </div>

                {/* Ticket Types */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <label className="form-label" style={{ margin: 0 }}><Ticket size={13} style={{ display: 'inline', marginRight: 4 }} />Ticket Types *</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <label className="form-label" style={{ margin: 0, fontSize: '0.78rem' }}>Currency:</label>
                      <select name="currency" className="form-select" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.82rem' }} value={form.currency} onChange={handleFormChange}>
                        <option value="NGN">NGN (₦)</option>
                        <option value="USD">USD ($)</option>
                        <option value="GBP">GBP (£)</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                    {ticketTypes.map((tt, idx) => (
                      <div key={idx} style={{ background: 'var(--color-bg-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.875rem 1rem', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Type name (e.g. VIP)"
                          value={tt.name}
                          onChange={e => updateTicketType(idx, 'name', e.target.value)}
                          style={{ fontSize: '0.85rem' }}
                          id={`ticket-type-name-${idx}`}
                        />
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Price"
                          min="0"
                          step="100"
                          value={tt.price}
                          onChange={e => updateTicketType(idx, 'price', e.target.value)}
                          style={{ fontSize: '0.85rem' }}
                          id={`ticket-type-price-${idx}`}
                        />
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Qty"
                          min="1"
                          value={tt.quantity}
                          onChange={e => updateTicketType(idx, 'quantity', e.target.value)}
                          style={{ fontSize: '0.85rem' }}
                          id={`ticket-type-qty-${idx}`}
                        />
                        <button type="button" onClick={() => removeTicketType(idx)} style={{ color: 'var(--color-rose)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', opacity: ticketTypes.length === 1 ? 0.3 : 1 }} disabled={ticketTypes.length === 1}>
                          <MinusCircle size={18} />
                        </button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--color-text-4)', marginTop: '0.25rem', paddingLeft: '0.25rem' }}>
                      <span style={{ flex: '2 1 0' }}>Name</span>
                      <span style={{ flex: '1 1 0' }}>Price (0 = Free)</span>
                      <span style={{ flex: '1 1 0' }}>Quantity</span>
                      <span style={{ width: 26 }}></span>
                    </div>
                  </div>
                  <button type="button" onClick={addTicketType} className="btn btn-ghost btn-sm" style={{ marginTop: '0.625rem' }} id="add-ticket-type">
                    <PlusCircle size={14} /> Add Ticket Type
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving} id="event-form-save">
                  {saving ? <div className="spinner" /> : editingEvent ? 'Save Changes' : '🎉 Create Event'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
