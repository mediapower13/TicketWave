import { useState, useEffect, useRef } from 'react'
import { QrCode, CheckCircle, XCircle, AlertTriangle, Camera, CameraOff, Users, Search, List, ScanLine } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatDate, formatTime } from '../lib/constants'
import toast from 'react-hot-toast'
import jsQR from 'jsqr'

export default function ScannerPage() {
  const { user } = useAuth()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const animFrameRef = useRef(null)

  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [tab, setTab] = useState('scanner') // 'scanner' | 'list'

  // Event selector
  const [events, setEvents] = useState([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [attendees, setAttendees] = useState([])
  const [attendeeSearch, setAttendeeSearch] = useState('')
  const [loadingAttendees, setLoadingAttendees] = useState(false)
  const [scanLog, setScanLog] = useState([]) // recent scans this session

  useEffect(() => {
    fetchOrganizerEvents()
    return () => stopCamera()
  }, [user])

  useEffect(() => {
    if (selectedEventId && tab === 'list') fetchAttendees()
  }, [selectedEventId, tab])

  const fetchOrganizerEvents = async () => {
    if (!user) return
    const { data } = await supabase
      .from('events')
      .select('id, title, start_at, status')
      .eq('organizer_id', user.id)
      .order('start_at', { ascending: false })
    setEvents(data || [])
    if (data && data.length > 0) setSelectedEventId(data[0].id)
  }

  const fetchAttendees = async () => {
    if (!selectedEventId) return
    setLoadingAttendees(true)
    const { data } = await supabase
      .from('tickets')
      .select('id, ticket_number, ticket_type_name, attendee_name, attendee_phone, status, scanned_at, profiles(full_name, email)')
      .eq('event_id', selectedEventId)
      .order('created_at', { ascending: false })
    setAttendees(data || [])
    setLoadingAttendees(false)
  }

  const startCamera = async () => {
    setError('')
    setResult(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
      setScanning(true)
      scanLoop()
    } catch {
      setError('Camera access denied. Please allow camera access and try again.')
    }
  }

  const stopCamera = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    setScanning(false)
  }

  const scanLoop = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const tick = async () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)

        let code = null

        // Try BarcodeDetector first (Chrome/Edge)
        try {
          if ('BarcodeDetector' in window) {
            const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
            const barcodes = await detector.detect(canvas)
            if (barcodes.length > 0) code = barcodes[0].rawValue
          }
        } catch {}

        // Fallback: jsQR (works in Firefox/Safari)
        if (!code) {
          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const qr = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' })
            if (qr) code = qr.data
          } catch {}
        }

        if (code) {
          stopCamera()
          await validateTicket(code)
          return
        }
      }
      animFrameRef.current = requestAnimationFrame(tick)
    }

    animFrameRef.current = requestAnimationFrame(tick)
  }

  const validateTicket = async (rawValue) => {
    setLoading(true)
    try {
      let parsed
      try { parsed = JSON.parse(rawValue) }
      catch { setResult({ status: 'invalid', message: 'QR code is not a valid TicketWave ticket.' }); return }

      const { ticketId, qrCode } = parsed
      if (!ticketId || !qrCode) { setResult({ status: 'invalid', message: 'Invalid ticket data.' }); return }

      const { data: ticket, error } = await supabase
        .from('tickets')
        .select('*, events(title, organizer_id, start_at, venue_name, location), profiles(full_name, email)')
        .eq('id', ticketId)
        .eq('qr_code', qrCode)
        .single()

      if (error || !ticket) { setResult({ status: 'invalid', message: 'Ticket not found in database.' }); return }
      if (ticket.events?.organizer_id !== user.id) { setResult({ status: 'invalid', message: 'This ticket is for a different organizer.' }); return }
      if (ticket.status === 'used') {
        setResult({ status: 'used', ticket, message: `Already checked in at ${ticket.scanned_at ? new Date(ticket.scanned_at).toLocaleTimeString('en-NG') : 'unknown time'}` })
        return
      }
      if (ticket.status === 'cancelled') { setResult({ status: 'invalid', message: 'This ticket has been cancelled.' }); return }

      // Mark as used
      await supabase.from('tickets').update({ status: 'used', scanned_at: new Date().toISOString(), scanned_by: user.id }).eq('id', ticketId)
      setResult({ status: 'valid', ticket })
      setScanLog(prev => [{ ...ticket, scanned_at: new Date().toISOString() }, ...prev.slice(0, 49)])
      toast.success('✅ Entry granted!')
      // Refresh attendee list if open
      if (selectedEventId === ticket.event_id && tab === 'list') fetchAttendees()
    } catch (err) {
      setResult({ status: 'invalid', message: err.message || 'Validation failed.' })
    } finally {
      setLoading(false)
    }
  }

  const handleManualSubmit = (e) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    validateTicket(manualCode.trim())
  }

  const handleManualCheckin = async (ticket) => {
    if (!confirm(`Check in ${ticket.attendee_name || ticket.profiles?.full_name || 'this attendee'}?`)) return
    const { error } = await supabase.from('tickets').update({ status: 'used', scanned_at: new Date().toISOString(), scanned_by: user.id }).eq('id', ticket.id)
    if (!error) { toast.success('Checked in!'); fetchAttendees() }
    else toast.error('Failed to check in')
  }

  const resetScan = () => { setResult(null); setManualCode('') }

  const selectedEvent = events.find(e => e.id === selectedEventId)
  const checkedInCount = attendees.filter(a => a.status === 'used').length
  const filteredAttendees = attendees.filter(a => {
    const q = attendeeSearch.toLowerCase()
    return !q || (a.attendee_name || a.profiles?.full_name || '').toLowerCase().includes(q) || (a.ticket_number || '').toLowerCase().includes(q)
  })

  return (
    <main className="page">
      <div className="page-header">
        <div className="container" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-header-title">QR Scanner</h1>
            <p className="page-header-subtitle">Scan tickets at the door or manage check-ins</p>
          </div>
          {/* Event selector */}
          <select className="form-select" style={{ maxWidth: 280 }} value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} id="scanner-event-select">
            <option value="">Select Event</option>
            {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: '4rem', maxWidth: 800 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
          <button className={`filter-chip ${tab === 'scanner' ? 'active' : ''}`} onClick={() => { setTab('scanner'); stopCamera() }} id="tab-scanner">
            <ScanLine size={14} /> QR Scanner
          </button>
          <button className={`filter-chip ${tab === 'list' ? 'active' : ''}`} onClick={() => { setTab('list'); fetchAttendees() }} id="tab-list">
            <List size={14} /> Check-in List {selectedEventId && `(${checkedInCount}/${attendees.length})`}
          </button>
        </div>

        {/* Scanner Tab */}
        {tab === 'scanner' && (
          <div style={{ maxWidth: 540, margin: '0 auto' }}>
            {!result && !loading && (
              <>
                {/* Camera */}
                <div style={{ position: 'relative', background: '#000', borderRadius: 'var(--radius-2xl)', overflow: 'hidden', marginBottom: '1.5rem', aspectRatio: '4/3' }}>
                  <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: scanning ? 'block' : 'none' }} playsInline muted />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />

                  {!scanning && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem' }}>
                      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary-light)' }}>
                        <Camera size={28} />
                      </div>
                      <button className="btn btn-primary btn-lg" onClick={startCamera} id="start-camera-btn">
                        <Camera size={16} /> Start Camera
                      </button>
                    </div>
                  )}

                  {scanning && (
                    <>
                      {/* Scan frame overlay */}
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 200, height: 200, position: 'relative' }}>
                          {[['0 0 auto auto', '0 auto auto 0'], ['auto 0 0 auto', 'auto auto 0 0']].map(([tl, br], q) =>
                            ['tl', 'br'].map((pos, k) => (
                              <div key={`${q}${k}`} style={{ position: 'absolute', width: 28, height: 28, borderColor: 'var(--color-primary-light)', borderStyle: 'solid', borderWidth: 0, ...(pos === 'tl' ? { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 } : { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }), borderRadius: 4 }} />
                            ))
                          )}
                        </div>
                      </div>
                      <button onClick={stopCamera} className="btn btn-sm" style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>
                        <CameraOff size={14} /> Stop
                      </button>
                    </>
                  )}
                </div>

                {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

                {/* Manual entry */}
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--color-text-2)' }}>Manual Entry / Paste QR Data</p>
                  <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input className="form-input" placeholder='Paste ticket JSON here...' value={manualCode} onChange={e => setManualCode(e.target.value)} style={{ flex: 1, fontSize: '0.82rem', fontFamily: 'monospace' }} id="manual-code-input" />
                    <button type="submit" className="btn btn-secondary" disabled={!manualCode.trim()}>Validate</button>
                  </form>
                </div>

                {/* Recent scans */}
                {scanLog.length > 0 && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-3)', marginBottom: '0.75rem' }}>Recent scans this session ({scanLog.length})</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {scanLog.slice(0, 5).map((t, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--color-bg-3)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }}>
                          <span style={{ fontWeight: 600 }}>{t.attendee_name || t.profiles?.full_name || 'Unknown'}</span>
                          <span style={{ color: 'var(--color-emerald)', fontSize: '0.75rem' }}>✅ {new Date(t.scanned_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {loading && (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 1rem' }} />
                <p style={{ color: 'var(--color-text-3)' }}>Validating ticket...</p>
              </div>
            )}

            {result && !loading && (
              <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                {/* Result card */}
                <div style={{
                  borderRadius: 'var(--radius-2xl)',
                  padding: '2.5rem 2rem',
                  background: result.status === 'valid' ? 'rgba(16,185,129,0.08)' : result.status === 'used' ? 'rgba(14,165,233,0.08)' : 'rgba(244,63,94,0.08)',
                  border: `2px solid ${result.status === 'valid' ? 'rgba(16,185,129,0.4)' : result.status === 'used' ? 'rgba(14,165,233,0.4)' : 'rgba(244,63,94,0.4)'}`,
                  marginBottom: '1.5rem',
                }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%', margin: '0 auto 1.25rem',
                    background: result.status === 'valid' ? 'rgba(16,185,129,0.15)' : result.status === 'used' ? 'rgba(14,165,233,0.15)' : 'rgba(244,63,94,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: result.status === 'valid' ? 'var(--color-emerald)' : result.status === 'used' ? 'var(--color-sky)' : 'var(--color-rose)',
                  }}>
                    {result.status === 'valid' ? <CheckCircle size={40} /> : result.status === 'used' ? <AlertTriangle size={40} /> : <XCircle size={40} />}
                  </div>

                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 900, marginBottom: '0.5rem', color: result.status === 'valid' ? 'var(--color-emerald)' : result.status === 'used' ? 'var(--color-sky)' : 'var(--color-rose)' }}>
                    {result.status === 'valid' ? 'ENTRY GRANTED ✅' : result.status === 'used' ? 'ALREADY USED ⚠️' : 'INVALID ❌'}
                  </h2>

                  {result.ticket && (
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <p style={{ fontSize: '1rem', fontWeight: 700 }}>{result.ticket.attendee_name || result.ticket.profiles?.full_name || 'Unknown'}</p>
                      {result.ticket.ticket_type_name && <span className="badge badge-primary" style={{ margin: '0 auto' }}>{result.ticket.ticket_type_name}</span>}
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-3)' }}>{result.ticket.events?.title}</p>
                      <p style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--color-text-4)' }}>{result.ticket.ticket_number}</p>
                      {result.message && <p style={{ fontSize: '0.82rem', color: 'var(--color-text-3)', marginTop: '0.25rem' }}>{result.message}</p>}
                    </div>
                  )}

                  {!result.ticket && result.message && (
                    <p style={{ fontSize: '0.9rem', color: 'var(--color-text-2)', marginTop: '0.5rem' }}>{result.message}</p>
                  )}
                </div>

                <button className="btn btn-primary btn-lg" onClick={resetScan} id="scan-another-btn">
                  <QrCode size={16} /> Scan Another Ticket
                </button>
              </div>
            )}
          </div>
        )}

        {/* Check-in List Tab */}
        {tab === 'list' && (
          <div>
            {!selectedEventId ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Users size={28} /></div>
                <h3 className="empty-state-title">Select an Event</h3>
                <p className="empty-state-text">Choose an event from the dropdown above to view the attendee check-in list.</p>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  {[
                    { label: 'Total Tickets', value: attendees.length, color: 'var(--color-primary-light)' },
                    { label: 'Checked In', value: checkedInCount, color: 'var(--color-emerald)' },
                    { label: 'Remaining', value: attendees.length - checkedInCount, color: 'var(--color-text-3)' },
                  ].map((s, i) => (
                    <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.6rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-3)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: '1.5rem', background: 'var(--color-border)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${attendees.length ? (checkedInCount / attendees.length) * 100 : 0}%`, background: 'var(--gradient-primary)', transition: 'width 0.5s', borderRadius: 4 }} />
                </div>

                {/* Search */}
                <div className="search-bar" style={{ marginBottom: '1.5rem' }}>
                  <Search size={16} />
                  <input type="text" placeholder="Search attendee name or ticket #..." value={attendeeSearch} onChange={e => setAttendeeSearch(e.target.value)} id="attendee-search" />
                </div>

                {loadingAttendees ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 'var(--radius-lg)' }} />)}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {filteredAttendees.length > 0 ? filteredAttendees.map(attendee => {
                      const isCheckedIn = attendee.status === 'used'
                      const name = attendee.attendee_name || attendee.profiles?.full_name || 'Unknown'
                      return (
                        <div key={attendee.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1rem', background: isCheckedIn ? 'rgba(16,185,129,0.06)' : 'var(--color-surface)', border: `1px solid ${isCheckedIn ? 'rgba(16,185,129,0.2)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-lg)', transition: 'all 0.15s' }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: isCheckedIn ? 'rgba(16,185,129,0.15)' : 'var(--color-bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isCheckedIn ? 'var(--color-emerald)' : 'var(--color-text-3)', flexShrink: 0, fontWeight: 700, fontSize: '0.9rem' }}>
                            {isCheckedIn ? <CheckCircle size={18} /> : name[0]?.toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</p>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.74rem', color: 'var(--color-text-4)', fontFamily: 'monospace' }}>{attendee.ticket_number}</span>
                              {attendee.ticket_type_name && <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>{attendee.ticket_type_name}</span>}
                              {isCheckedIn && attendee.scanned_at && <span style={{ fontSize: '0.72rem', color: 'var(--color-emerald)' }}>✓ {new Date(attendee.scanned_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</span>}
                            </div>
                          </div>
                          {!isCheckedIn && (
                            <button
                              onClick={() => handleManualCheckin(attendee)}
                              className="btn btn-sm btn-secondary"
                              style={{ flexShrink: 0 }}
                              id={`checkin-${attendee.id}`}
                            >
                              Check In
                            </button>
                          )}
                          {isCheckedIn && (
                            <span style={{ color: 'var(--color-emerald)', fontSize: '0.8rem', fontWeight: 600, flexShrink: 0 }}>✅ In</span>
                          )}
                        </div>
                      )
                    }) : (
                      <div className="empty-state">
                        <div className="empty-state-icon"><Users size={24} /></div>
                        <h3 className="empty-state-title">No attendees found</h3>
                        <p className="empty-state-text">No tickets sold for this event yet, or search returned no results.</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
