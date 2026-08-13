import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  Eye, EyeOff, Mail, Lock, User, Zap, Building,
  CheckCircle, RefreshCw, WifiOff, ArrowLeft, Send
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { getAppUrl } from '../lib/appUrl'
import toast from 'react-hot-toast'

/* ── Human-readable Supabase error messages ─────────────────────── */
function parseError(err) {
  if (!err) return ''
  const msg = (err.message || String(err)).toLowerCase()
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network error'))
    return 'Connection failed. Check your internet connection and try again.'
  if (msg.includes('email not confirmed'))
    return 'EMAIL_NOT_CONFIRMED'
  if (msg.includes('invalid login credentials') || msg.includes('invalid email or password'))
    return 'Wrong email or password. Please try again.'
  if (msg.includes('user already registered') || msg.includes('already been registered'))
    return 'An account with this email already exists. Try signing in instead.'
  if (msg.includes('password should be at least') || msg.includes('password is too short'))
    return 'Password must be at least 6 characters long.'
  if (msg.includes('rate limit') || msg.includes('too many requests'))
    return 'Too many attempts. Please wait a minute and try again.'
  if (msg.includes('timed out') || msg.includes('aborted'))
    return 'Request timed out. Please check your connection and try again.'
  if (msg.includes('no internet') || msg.includes('offline'))
    return 'No internet connection. Please check your network.'
  if (msg.includes('email address') && msg.includes('invalid'))
    return 'Please enter a valid email address.'
  return err.message || 'Something went wrong. Please try again.'
}

/* ── Countdown hook ─────────────────────────────────────────────── */
function useCountdown(seconds) {
  const [remaining, setRemaining] = useState(0)
  const start = () => setRemaining(seconds)
  useEffect(() => {
    if (remaining <= 0) return
    const t = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000)
    return () => clearInterval(t)
  }, [remaining])
  return { remaining, start }
}

/* ═══════════════════════════════════════════════════════════════════
   AuthPage
═══════════════════════════════════════════════════════════════════ */
export default function AuthPage() {
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') || 'signin')
  const [role, setRole] = useState(searchParams.get('role') || 'attendee')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  /* screens: 'form' | 'confirm_email' | 'magic_sent' | 'magic_verify' */
  const [screen, setScreen] = useState('form')
  const [pendingEmail, setPendingEmail] = useState('')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const otpRefs = useRef([])
  const resendCountdown = useCountdown(60)

  const [form, setForm] = useState({
    email: '', password: '', fullName: '', confirmPassword: '',
  })

  const { signIn, signUp, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { if (user) navigate('/') }, [user, navigate])

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  /* ── Sign In ──────────────────────────────────────────────────── */
  const handleSignIn = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) { setError('Please fill in all fields'); return }
    setLoading(true); setError('')

    const { data, error: err } = await signIn({ email: form.email, password: form.password })

    if (err) {
      const parsed = parseError(err)
      if (parsed === 'EMAIL_NOT_CONFIRMED') {
        setPendingEmail(form.email)
        setScreen('confirm_email')
        setLoading(false)
        return
      }
      setError(parsed)
      toast.error('Sign in failed')
    } else if (data?.session) {
      toast.success('Welcome back! 🎉')
      // Redirect organizers to dashboard, attendees to home
      const userRole = data.session.user?.user_metadata?.role
      navigate(userRole === 'organizer' ? '/dashboard' : '/')
    }
    setLoading(false)
  }

  /* ── Sign Up ──────────────────────────────────────────────────── */
  const handleSignUp = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password || !form.fullName) { setError('Please fill in all fields'); return }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')

    const { data, error: err } = await signUp({
      email: form.email, password: form.password,
      fullName: form.fullName, role,
    })

    if (err) {
      setError(parseError(err))
      toast.error('Sign up failed')
    } else if (data?.session) {
      // Email confirmation OFF — user is immediately logged in
      toast.success('Account created! Welcome 🎉')
      navigate(role === 'organizer' ? '/dashboard' : '/')
    } else {
      // Email confirmation ON — need to verify
      setPendingEmail(form.email)
      setScreen('confirm_email')
      resendCountdown.start()
      toast.success('Check your email for the confirmation link!')
    }
    setLoading(false)
  }

  /* ── Resend confirmation email ────────────────────────────────── */
  const handleResendConfirmation = async () => {
    if (resendCountdown.remaining > 0) return
    setLoading(true)
    const { error: err } = await supabase.auth.resend({
      type: 'signup',
      email: pendingEmail,
      options: { emailRedirectTo: getAppUrl('/auth?tab=signin') },
    })
    if (err) {
      toast.error('Could not resend: ' + parseError(err))
    } else {
      resendCountdown.start()
      toast.success('Confirmation email resent!')
    }
    setLoading(false)
  }

  /* ── Magic Link (OTP) ─────────────────────────────────────────── */
  const handleSendMagicLink = async () => {
    if (!form.email) { setError('Enter your email first'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email: form.email,
      options: {
        shouldCreateUser: false, // Only send to existing accounts
        emailRedirectTo: getAppUrl('/'),
      },
    })
    if (err) {
      // If user doesn't exist, allow creation via magic link
      const { error: err2 } = await supabase.auth.signInWithOtp({
        email: form.email,
        options: { shouldCreateUser: true, emailRedirectTo: getAppUrl('/') },
      })
      if (err2) {
        setError(parseError(err2)); setLoading(false); return
      }
    }
    setPendingEmail(form.email)
    setScreen('magic_sent')
    resendCountdown.start()
    toast.success('Magic link sent! Check your email.')
    setLoading(false)
  }

  /* ── OTP digit verification ───────────────────────────────────── */
  const handleOtpChange = (i, val) => {
    if (!/^\d*$/.test(val)) return
    const digits = [...otpDigits]
    digits[i] = val.slice(-1)
    setOtpDigits(digits)
    if (val && i < 5) otpRefs.current[i + 1]?.focus()
  }

  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otpDigits[i] && i > 0) {
      otpRefs.current[i - 1]?.focus()
    }
  }

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setOtpDigits(pasted.split(''))
      otpRefs.current[5]?.focus()
    }
    e.preventDefault()
  }

  const handleVerifyOtp = async () => {
    const token = otpDigits.join('')
    if (token.length < 6) { setError('Enter the full 6-digit code'); return }
    setLoading(true); setError('')
    const { data, error: err } = await supabase.auth.verifyOtp({
      email: pendingEmail,
      token,
      type: 'email',
    })
    if (err) {
      setError(parseError(err) || 'Invalid or expired code. Try requesting a new one.')
      toast.error('Verification failed')
    } else if (data?.session) {
      toast.success('Signed in! Welcome 🎉')
      navigate('/')
    }
    setLoading(false)
  }

  const switchTab = (t) => { setTab(t); setError(''); setScreen('form') }

  /* ═══════════════════════════════════════════════════════════════
     Screens
  ═══════════════════════════════════════════════════════════════ */

  /* Confirm Email screen */
  if (screen === 'confirm_email') {
    return (
      <main className="page" style={centeredPage}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div className="card" style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
            <div style={iconCircle('#10b981', 'rgba(16,185,129,0.12)')}>
              <Mail size={34} color="#10b981" />
            </div>
            <h2 style={heading}>Confirm Your Email</h2>
            <p style={subText}>
              We sent a confirmation link to<br />
              <strong style={{ color: 'var(--color-text-1)' }}>{pendingEmail}</strong>
            </p>
            <p style={{ ...subText, marginTop: '0.75rem', fontSize: '0.82rem' }}>
              Click the link in the email to activate your account, then come back and sign in.
              Check your <strong>spam / junk</strong> folder too.
            </p>

            <div style={{ margin: '1.75rem 0 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => { setScreen('form'); setTab('signin') }}
                id="goto-signin-btn"
              >
                <Zap size={15} /> I've confirmed — Sign In
              </button>
              <button
                className="btn"
                style={{ width: '100%', opacity: resendCountdown.remaining > 0 ? 0.5 : 1 }}
                onClick={handleResendConfirmation}
                disabled={loading || resendCountdown.remaining > 0}
                id="resend-confirm-btn"
              >
                {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Sending…</> :
                  resendCountdown.remaining > 0
                    ? `Resend in ${resendCountdown.remaining}s`
                    : <><RefreshCw size={14} /> Resend Confirmation Email</>}
              </button>
            </div>

            <button
              style={backBtn}
              onClick={() => setScreen('form')}
            >
              <ArrowLeft size={14} /> Back
            </button>
          </div>
        </div>
      </main>
    )
  }

  /* Magic Link Sent screen */
  if (screen === 'magic_sent') {
    return (
      <main className="page" style={centeredPage}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div className="card" style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
            <div style={iconCircle('var(--color-primary-light)', 'rgba(124,58,237,0.12)')}>
              <Send size={30} color="var(--color-primary-light)" />
            </div>
            <h2 style={heading}>Check Your Email</h2>
            <p style={subText}>
              We sent a sign-in link to<br />
              <strong style={{ color: 'var(--color-text-1)' }}>{pendingEmail}</strong>
            </p>
            <p style={{ ...subText, marginTop: '0.5rem', fontSize: '0.82rem' }}>
              Click the link in the email to sign in instantly — no password needed.
            </p>

            <div style={{ margin: '1.5rem 0 0.75rem' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-3)', marginBottom: '0.75rem' }}>
                Or enter the 6-digit code from the email:
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1rem' }}>
                {otpDigits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => otpRefs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    onPaste={i === 0 ? handleOtpPaste : undefined}
                    className="form-input"
                    style={{
                      width: 46, height: 52, textAlign: 'center', fontSize: '1.4rem',
                      fontWeight: 700, padding: 0, letterSpacing: 0,
                    }}
                    id={`otp-${i}`}
                  />
                ))}
              </div>

              {error && (
                <div className="alert alert-error" style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                  {error}
                </div>
              )}

              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={handleVerifyOtp}
                disabled={loading || otpDigits.join('').length < 6}
                id="verify-otp-btn"
              >
                {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Verifying…</> : <><CheckCircle size={15} /> Verify Code</>}
              </button>
            </div>

            <button
              className="btn"
              style={{ width: '100%', marginTop: '0.75rem', opacity: resendCountdown.remaining > 0 ? 0.5 : 1 }}
              onClick={handleSendMagicLink}
              disabled={loading || resendCountdown.remaining > 0}
              id="resend-magic-btn"
            >
              {resendCountdown.remaining > 0 ? `Resend in ${resendCountdown.remaining}s` : <><RefreshCw size={14} /> Resend Link</>}
            </button>

            <button style={backBtn} onClick={() => setScreen('form')}>
              <ArrowLeft size={14} /> Back
            </button>
          </div>
        </div>
      </main>
    )
  }

  /* ═══════════════════════════════════════════════════════════════
     Main Form
  ═══════════════════════════════════════════════════════════════ */
  return (
    <main className="page" style={centeredPage}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Offline banner */}
        {!isOnline && (
          <div style={offlineBanner}>
            <WifiOff size={15} />
            <span>You're offline — please check your internet connection.</span>
          </div>
        )}

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <Link to="/" className="navbar-logo" style={{ fontSize: '2rem' }}>TicketWave</Link>
          <p style={{ color: 'var(--color-text-3)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {tab === 'signin' ? 'Welcome back! Sign in to your account.' : 'Create your account to get started.'}
          </p>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: '1.75rem' }}>
            <button className={`tab ${tab === 'signin' ? 'active' : ''}`} onClick={() => switchTab('signin')} id="auth-signin-tab">Sign In</button>
            <button className={`tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => switchTab('signup')} id="auth-signup-tab">Create Account</button>
          </div>

          {/* Error */}
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1.25rem', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          {/* ── SIGN IN FORM ── */}
          {tab === 'signin' ? (
            <form onSubmit={handleSignIn} style={formStack}>
              <div className="form-group">
                <label className="form-label" htmlFor="signin-email">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={iconLeft} />
                  <input id="signin-email" name="email" type="email" className="form-input"
                    placeholder="you@example.com" value={form.email} onChange={handleChange}
                    style={{ paddingLeft: '2.5rem' }} autoComplete="email" required disabled={loading} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="signin-password">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={iconLeft} />
                  <input id="signin-password" name="password" type={showPassword ? 'text' : 'password'}
                    className="form-input" placeholder="••••••••" value={form.password} onChange={handleChange}
                    style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }} autoComplete="current-password"
                    required disabled={loading} />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    style={eyeBtn} aria-label="Toggle visibility">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.875rem' }}
                disabled={loading || !isOnline} id="signin-submit">
                {loading
                  ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Signing in…</>
                  : <><Zap size={15} /> Sign In</>}
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--color-text-4)', fontSize: '0.8rem' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                <span>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
              </div>

              {/* Magic Link option */}
              <button type="button" className="btn" style={{ width: '100%' }}
                onClick={handleSendMagicLink} disabled={loading || !isOnline} id="magic-link-btn">
                <Mail size={15} /> Sign in with Magic Link (no password)
              </button>
            </form>
          ) : (
            /* ── SIGN UP FORM ── */
            <form onSubmit={handleSignUp} style={formStack}>
              {/* Role selector */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { val: 'attendee', icon: <User size={22} />, label: 'Attendee', sub: 'Buy tickets' },
                  { val: 'organizer', icon: <Building size={22} />, label: 'Organizer', sub: 'Host events' },
                ].map(({ val, icon, label, sub }) => (
                  <button key={val} type="button" onClick={() => setRole(val)} id={`role-${val}`}
                    style={{
                      padding: '1rem', borderRadius: 'var(--radius-lg)',
                      border: `2px solid ${role === val ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: role === val ? 'rgba(124,58,237,0.12)' : 'var(--color-surface)',
                      color: role === val ? 'var(--color-primary-light)' : 'var(--color-text-3)',
                      cursor: 'pointer', transition: 'all 0.2s',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
                    }}>
                    {icon}
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>{sub}</span>
                  </button>
                ))}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="signup-name">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={iconLeft} />
                  <input id="signup-name" name="fullName" type="text" className="form-input"
                    placeholder="John Doe" value={form.fullName} onChange={handleChange}
                    style={{ paddingLeft: '2.5rem' }} autoComplete="name" required disabled={loading} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="signup-email">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={iconLeft} />
                  <input id="signup-email" name="email" type="email" className="form-input"
                    placeholder="you@example.com" value={form.email} onChange={handleChange}
                    style={{ paddingLeft: '2.5rem' }} autoComplete="email" required disabled={loading} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="signup-password">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={iconLeft} />
                  <input id="signup-password" name="password" type={showPassword ? 'text' : 'password'}
                    className="form-input" placeholder="Min. 6 characters" value={form.password}
                    onChange={handleChange} style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }}
                    autoComplete="new-password" required disabled={loading} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} style={eyeBtn}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="signup-confirm">Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={iconLeft} />
                  <input id="signup-confirm" name="confirmPassword" type={showPassword ? 'text' : 'password'}
                    className="form-input" placeholder="••••••••" value={form.confirmPassword}
                    onChange={handleChange} style={{ paddingLeft: '2.5rem' }}
                    autoComplete="new-password" required disabled={loading} />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.875rem' }}
                disabled={loading || !isOnline} id="signup-submit">
                {loading
                  ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Creating account…</>
                  : <><Zap size={15} /> Create Account</>}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--color-text-4)', marginTop: '1.5rem' }}>
          By continuing, you agree to TicketWave's Terms of Service and Privacy Policy.
        </p>
      </div>
    </main>
  )
}

/* ── Shared styles ────────────────────────────────────────────────── */
const centeredPage = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  minHeight: '100vh', padding: '6rem 1rem 2rem',
}

const formStack = { display: 'flex', flexDirection: 'column', gap: '1.25rem' }

const iconLeft = {
  position: 'absolute', left: '0.875rem', top: '50%',
  transform: 'translateY(-50%)', color: 'var(--color-text-4)',
}

const eyeBtn = {
  position: 'absolute', right: '0.875rem', top: '50%',
  transform: 'translateY(-50%)', color: 'var(--color-text-4)',
  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
}

const offlineBanner = {
  display: 'flex', alignItems: 'center', gap: '0.625rem',
  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
  borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem',
  marginBottom: '1rem', color: '#f87171', fontSize: '0.85rem',
}

const heading = {
  fontSize: '1.375rem', fontWeight: 700, color: 'var(--color-text-1)',
  margin: '0 0 0.625rem',
}

const subText = {
  color: 'var(--color-text-3)', lineHeight: 1.65, margin: 0, fontSize: '0.9rem',
}

const backBtn = {
  display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
  fontSize: '0.82rem', color: 'var(--color-text-4)', background: 'none',
  border: 'none', cursor: 'pointer', padding: '0.25rem 0', marginTop: '0.5rem',
}

const iconCircle = (color, bg) => ({
  width: 70, height: 70, borderRadius: '50%', background: bg,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  margin: '0 auto 1.25rem',
})
