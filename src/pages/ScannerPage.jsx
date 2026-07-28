import { useState, useEffect, useRef } from 'react'
import { QrCode, CheckCircle, XCircle, AlertTriangle, Camera, CameraOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatDate, formatTime } from '../lib/constants'
import toast from 'react-hot-toast'

export default function ScannerPage() {
  const { user } = useAuth()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const animFrameRef = useRef(null)

  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { status: 'valid'|'used'|'invalid', ticket, event }
  const [loading, setLoading] = useState(false)
  const [manualCode, setManualCode] = useState('')

  useEffect(() => {
    return () => stopCamera()
  }, [])

  const startCamera = async () => {
    setError('')
    setResult(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setScanning(true)
      scanLoop()
    } catch (err) {
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

        try {
          // Use BarcodeDetector API if available
          if ('BarcodeDetector' in window) {
            const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
            const barcodes = await detector.detect(canvas)
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue
              stopCamera()
              await validateTicket(code)
              return
            }
          }
        } catch {}
      }
      animFrameRef.current = requestAnimationFrame(tick)
    }

    animFrameRef.current = requestAnimationFrame(tick)
  }

  const validateTicket = async (rawValue) => {
    setLoading(true)
    setResult(null)

    try {
      let ticketData
      try {
        ticketData = JSON.parse(rawValue)
      } catch {
        setResult({ status: 'invalid', message: 'Invalid QR code format' })
        setLoading(false)
        return
      }

      const { ticketId, eventId, qrCode } = ticketData

      // Verify the ticket exists and belongs to an event this organizer manages
      const { data: ticket, error } = await supabase
        .from('tickets')
        .select('*, events(title, start_at, end_at, location, venue_name, organizer_id), profiles(full_name, email)')
        .eq('id', ticketId)
        .eq('qr_code', qrCode)
        .single()

      if (error || !ticket) {
        setResult({ status: 'invalid', message: 'Ticket not found or invalid' })
        setLoading(false)
        return
      }

      // Check organizer ownership
      if (ticket.events?.organizer_id !== user.id) {
        setResult({ status: 'invalid', message: 'This ticket is not for your event' })
        setLoading(false)
        return
      }

      if (ticket.status === 'used') {
        setResult({
          status: 'used',
          message: `Already scanned on ${formatDate(ticket.scanned_at)}`,
          ticket,
        })
        toast.error('Ticket already used!')
        setLoading(false)
        return
      }

      if (ticket.status !== 'active') {
        setResult({ status: 'invalid', message: `Ticket is ${ticket.status}` })
        setLoading(false)
        return
      }

      // Mark as used
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ status: 'used', scanned_at: new Date().toISOString(), scanned_by: user.id })
        .eq('id', ticketId)

      if (updateError) throw updateError

      setResult({ status: 'valid', ticket })
      toast.success('Valid ticket! Entry granted ✅')
    } catch (err) {
      setResult({ status: 'invalid', message: 'Error validating ticket' })
    } finally {
      setLoading(false)
    }
  }

  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    await validateTicket(manualCode.trim())
    setManualCode('')
  }

  const reset = () => {
    setResult(null)
    setError('')
    setManualCode('')
  }

  return (
    <main className="page">
      <div className="page-header">
        <div className="container">
          <h1 className="page-header-title">QR Ticket Scanner</h1>
          <p className="page-header-subtitle">Scan attendee QR codes to validate entry</p>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: '4rem', maxWidth: 720 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
          {/* Camera scanner */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="scanner-container" style={{ background: 'var(--color-bg-3)', minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {scanning ? (
                <>
                  <video
                    ref={videoRef}
                    style={{ width: '100%', display: 'block' }}
                    playsInline
                    muted
                  />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  <div className="scanner-overlay">
                    <div className="scanner-corner scanner-corner-tl" />
                    <div className="scanner-corner scanner-corner-tr" />
                    <div className="scanner-corner scanner-corner-bl" />
                    <div className="scanner-corner scanner-corner-br" />
                    <div className="scanner-line" />
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-3)' }}>
                  <QrCode size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
                  <p style={{ fontSize: '0.9rem' }}>Camera not active</p>
                </div>
              )}
            </div>

            {scanning ? (
              <button className="btn btn-secondary" onClick={stopCamera} id="stop-camera">
                <CameraOff size={15} /> Stop Camera
              </button>
            ) : (
              <button className="btn btn-primary" onClick={startCamera} id="start-camera">
                <Camera size={15} /> Start Camera Scanner
              </button>
            )}

            {error && (
              <div className="alert alert-error">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Result + Manual */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Scan result */}
            {loading && (
              <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto', width: 36, height: 36 }} />
                <p style={{ marginTop: '1rem', color: 'var(--color-text-3)' }}>Validating ticket...</p>
              </div>
            )}

            {result && !loading && (
              <div style={{
                borderRadius: 'var(--radius-xl)',
                border: `2px solid ${
                  result.status === 'valid' ? 'rgba(16,185,129,0.5)'
                  : result.status === 'used' ? 'rgba(14,165,233,0.5)'
                  : 'rgba(244,63,94,0.5)'
                }`,
                background: result.status === 'valid' ? 'rgba(16,185,129,0.08)' : result.status === 'used' ? 'rgba(14,165,233,0.08)' : 'rgba(244,63,94,0.08)',
                padding: '1.5rem',
                animation: 'fadeIn 0.3s ease',
              }} id="scan-result">
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  {result.status === 'valid' ? (
                    <CheckCircle size={48} style={{ color: 'var(--color-emerald)', margin: '0 auto' }} />
                  ) : result.status === 'used' ? (
                    <AlertTriangle size={48} style={{ color: 'var(--color-sky)', margin: '0 auto' }} />
                  ) : (
                    <XCircle size={48} style={{ color: 'var(--color-rose)', margin: '0 auto' }} />
                  )}
                  <h3 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.3rem',
                    fontWeight: 800,
                    marginTop: '0.75rem',
                    color: result.status === 'valid' ? 'var(--color-emerald)' : result.status === 'used' ? 'var(--color-sky)' : 'var(--color-rose)',
                  }}>
                    {result.status === 'valid' ? 'ENTRY GRANTED' : result.status === 'used' ? 'ALREADY USED' : 'INVALID TICKET'}
                  </h3>
                  {result.message && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-3)', marginTop: '0.375rem' }}>{result.message}</p>
                  )}
                </div>

                {result.ticket && (
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-lg)', padding: '1rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-3)' }}>Attendee</span>
                      <strong>{result.ticket.profiles?.full_name || 'Unknown'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-3)' }}>Event</span>
                      <strong style={{ textAlign: 'right', maxWidth: '60%' }}>{result.ticket.events?.title}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-3)' }}>Ticket #</span>
                      <span style={{ fontFamily: 'monospace' }}>{result.ticket.ticket_number}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-3)' }}>Time</span>
                      <span>{formatTime(result.ticket.events?.start_at)}</span>
                    </div>
                  </div>
                )}

                <button className="btn btn-secondary" style={{ width: '100%', marginTop: '1rem' }} onClick={reset} id="scan-reset">
                  Scan Another Ticket
                </button>
              </div>
            )}

            {/* Manual input */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
                Manual Entry
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-3)', marginBottom: '1rem' }}>
                Paste a QR code value or ticket JSON to validate manually.
              </p>
              <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <textarea
                  id="manual-qr-input"
                  className="form-textarea"
                  placeholder='Paste QR data here e.g. {"ticketId":"...","eventId":"...","qrCode":"..."}'
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  rows={3}
                />
                <button type="submit" className="btn btn-primary" disabled={loading || !manualCode.trim()} id="manual-validate-btn">
                  Validate Ticket
                </button>
              </form>
            </div>

            {/* Instructions */}
            <div className="alert alert-info">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.82rem' }}>
                <strong>💡 Scanner Tips</strong>
                <ul style={{ paddingLeft: '1rem', color: 'var(--color-text-2)', lineHeight: 1.8 }}>
                  <li>This scanner works best in Chrome or Edge</li>
                  <li>Ensure good lighting when scanning</li>
                  <li>Only your event's tickets will be validated</li>
                  <li>Each ticket can only be scanned once</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
