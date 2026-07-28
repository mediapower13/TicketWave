import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { EVENT_CATEGORIES } from '../lib/constants'
import EventCard from '../components/EventCard'

const SORT_OPTIONS = [
  { value: 'start_at', label: 'Date (Earliest)' },
  { value: 'price_asc', label: 'Price (Low to High)' },
  { value: 'price_desc', label: 'Price (High to Low)' },
  { value: 'created_at', label: 'Newest Listed' },
]

export default function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [eventType, setEventType] = useState(searchParams.get('type') || '')
  const [sort, setSort] = useState('start_at')
  const [showFree, setShowFree] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    fetchEvents()
  }, [category, eventType, sort, showFree])

  const fetchEvents = async (searchTerm = search) => {
    setLoading(true)
    try {
      let query = supabase
        .from('events')
        .select('*', { count: 'exact' })
        .eq('status', 'published')
        .gte('start_at', new Date().toISOString())

      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`)
      }
      if (category) query = query.eq('category', category)
      if (eventType) query = query.eq('event_type', eventType)
      if (showFree) query = query.eq('price', 0)

      if (sort === 'price_asc') query = query.order('price', { ascending: true })
      else if (sort === 'price_desc') query = query.order('price', { ascending: false })
      else if (sort === 'created_at') query = query.order('created_at', { ascending: false })
      else query = query.order('start_at', { ascending: true })

      const { data, count, error } = await query
      if (error) throw error
      setEvents(data || [])
      setTotalCount(count || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    fetchEvents(search)
  }

  const clearFilter = (filterName) => {
    if (filterName === 'category') setCategory('')
    if (filterName === 'eventType') setEventType('')
    if (filterName === 'showFree') setShowFree(false)
    if (filterName === 'search') { setSearch(''); fetchEvents('') }
  }

  const clearAll = () => {
    setCategory(''); setEventType(''); setShowFree(false); setSearch('')
    fetchEvents('')
  }

  const activeFilters = [
    category && { key: 'category', label: category },
    eventType && { key: 'eventType', label: eventType },
    showFree && { key: 'showFree', label: 'Free Events' },
    search && { key: 'search', label: `"${search}"` },
  ].filter(Boolean)

  return (
    <main className="page">
      {/* Page Header */}
      <div className="page-header">
        <div className="container">
          <h1 className="page-header-title">Discover Events</h1>
          <p className="page-header-subtitle">Find amazing events happening near you and online</p>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: '4rem' }}>
        {/* Search + Filters */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <form onSubmit={handleSearch} style={{ flex: '1 1 300px' }}>
            <div className="search-bar">
              <Search size={18} />
              <input
                id="events-search"
                type="text"
                placeholder="Search events..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button type="button" onClick={() => clearFilter('search')} style={{ color: 'var(--color-text-4)', padding: '0 0.25rem' }}>
                  <X size={14} />
                </button>
              )}
            </div>
          </form>

          <select
            className="form-select"
            style={{ flex: '0 1 200px', borderRadius: 'var(--radius-lg)' }}
            value={sort}
            onChange={e => setSort(e.target.value)}
            id="events-sort"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
          {/* Event type */}
          {['physical', 'online', 'hybrid'].map(t => (
            <button
              key={t}
              className={`filter-chip ${eventType === t ? 'active' : ''}`}
              onClick={() => setEventType(eventType === t ? '' : t)}
            >
              {t === 'physical' ? '📍' : t === 'online' ? '🌍' : '🎥'}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <button
            className={`filter-chip ${showFree ? 'active' : ''}`}
            onClick={() => setShowFree(!showFree)}
          >
            ✨ Free
          </button>

          <div style={{ height: 24, width: 1, background: 'var(--color-border)', margin: '0 0.25rem' }} />

          {/* Categories */}
          <select
            className="form-select"
            style={{ borderRadius: 'var(--radius-full)', padding: '0.375rem 2rem 0.375rem 0.875rem', fontSize: '0.82rem', height: 'auto', flex: '0 0 auto' }}
            value={category}
            onChange={e => setCategory(e.target.value)}
            id="events-category"
          >
            <option value="">All Categories</option>
            {EVENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Active filter pills */}
        {activeFilters.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-3)', marginRight: '0.25rem' }}>Filters:</span>
            {activeFilters.map(f => (
              <button
                key={f.key}
                onClick={() => clearFilter(f.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.25rem 0.625rem',
                  background: 'rgba(124,58,237,0.15)',
                  border: '1px solid rgba(124,58,237,0.3)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.78rem',
                  color: 'var(--color-primary-light)',
                  cursor: 'pointer',
                }}
              >
                {f.label} <X size={11} />
              </button>
            ))}
            <button onClick={clearAll} style={{ fontSize: '0.78rem', color: 'var(--color-text-4)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: '0.25rem' }}>
              Clear all
            </button>
          </div>
        )}

        {/* Results count */}
        {!loading && (
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-3)', marginBottom: '1.5rem' }}>
            {totalCount} event{totalCount !== 1 ? 's' : ''} found
          </p>
        )}

        {/* Events grid */}
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
              <SlidersHorizontal size={28} />
            </div>
            <h3 className="empty-state-title">No events found</h3>
            <p className="empty-state-text">
              {activeFilters.length > 0
                ? 'Try adjusting your filters to find more events.'
                : 'No upcoming events at the moment. Check back soon!'}
            </p>
            {activeFilters.length > 0 && (
              <button className="btn btn-secondary" onClick={clearAll}>Clear Filters</button>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
