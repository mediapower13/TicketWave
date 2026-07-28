import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, User, Zap, Building } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') || 'signin')
  const [role, setRole] = useState(searchParams.get('role') || 'attendee')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    confirmPassword: '',
  })

  const { signIn, signUp, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/')
  }, [user, navigate])

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSignIn = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) { setError('Please fill in all fields'); return }
    setLoading(true)
    const { error } = await signIn({ email: form.email, password: form.password })
    if (error) {
      setError(error.message)
      toast.error('Sign in failed')
    } else {
      toast.success('Welcome back! 🎉')
      navigate('/')
    }
    setLoading(false)
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password || !form.fullName) { setError('Please fill in all fields'); return }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    const { error } = await signUp({ email: form.email, password: form.password, fullName: form.fullName, role })
    if (error) {
      setError(error.message)
      toast.error('Sign up failed')
    } else {
      toast.success('Account created! Check your email to confirm.')
      setTab('signin')
    }
    setLoading(false)
  }

  return (
    <main className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '6rem 1rem 2rem' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <Link to="/" className="navbar-logo" style={{ fontSize: '2rem' }}>TicketWave</Link>
          <p style={{ color: 'var(--color-text-3)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            {tab === 'signin' ? 'Welcome back! Sign in to your account.' : 'Create your account to get started.'}
          </p>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: '1.75rem' }}>
            <button
              className={`tab ${tab === 'signin' ? 'active' : ''}`}
              onClick={() => { setTab('signin'); setError('') }}
              id="auth-signin-tab"
            >
              Sign In
            </button>
            <button
              className={`tab ${tab === 'signup' ? 'active' : ''}`}
              onClick={() => { setTab('signup'); setError('') }}
              id="auth-signup-tab"
            >
              Create Account
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
              <span>{error}</span>
            </div>
          )}

          {tab === 'signin' ? (
            <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="signin-email">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-4)' }} />
                  <input
                    id="signin-email"
                    name="email"
                    type="email"
                    className="form-input"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={handleChange}
                    style={{ paddingLeft: '2.5rem' }}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="signin-password">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-4)' }} />
                  <input
                    id="signin-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                    style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.875rem' }} disabled={loading} id="signin-submit">
                {loading ? <div className="spinner" /> : <><Zap size={15} /> Sign In</>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Role selector */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setRole('attendee')}
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-lg)',
                    border: `2px solid ${role === 'attendee' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: role === 'attendee' ? 'rgba(124,58,237,0.12)' : 'var(--color-surface)',
                    color: role === 'attendee' ? 'var(--color-primary-light)' : 'var(--color-text-3)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                  id="role-attendee"
                >
                  <User size={22} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Attendee</span>
                  <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>Buy tickets</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('organizer')}
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-lg)',
                    border: `2px solid ${role === 'organizer' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: role === 'organizer' ? 'rgba(124,58,237,0.12)' : 'var(--color-surface)',
                    color: role === 'organizer' ? 'var(--color-primary-light)' : 'var(--color-text-3)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                  id="role-organizer"
                >
                  <Building size={22} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Organizer</span>
                  <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>Host events</span>
                </button>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="signup-name">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-4)' }} />
                  <input id="signup-name" name="fullName" type="text" className="form-input" placeholder="John Doe" value={form.fullName} onChange={handleChange} style={{ paddingLeft: '2.5rem' }} autoComplete="name" required />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="signup-email">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-4)' }} />
                  <input id="signup-email" name="email" type="email" className="form-input" placeholder="you@example.com" value={form.email} onChange={handleChange} style={{ paddingLeft: '2.5rem' }} autoComplete="email" required />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="signup-password">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-4)' }} />
                  <input
                    id="signup-password" name="password" type={showPassword ? 'text' : 'password'}
                    className="form-input" placeholder="Min. 6 characters" value={form.password} onChange={handleChange}
                    style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }} autoComplete="new-password" required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="signup-confirm">Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-4)' }} />
                  <input
                    id="signup-confirm" name="confirmPassword" type={showPassword ? 'text' : 'password'}
                    className="form-input" placeholder="••••••••" value={form.confirmPassword} onChange={handleChange}
                    style={{ paddingLeft: '2.5rem' }} autoComplete="new-password" required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.875rem' }} disabled={loading} id="signup-submit">
                {loading ? <div className="spinner" /> : <><Zap size={15} /> Create Account</>}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-4)', marginTop: '1.5rem' }}>
          By continuing, you agree to TicketWave's Terms of Service and Privacy Policy.
        </p>
      </div>
    </main>
  )
}
