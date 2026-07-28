import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Ticket, LayoutDashboard, QrCode, LogOut, User, Menu, X, Zap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function Navbar() {
  const { user, profile, signOut, isOrganizer } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (!error) {
      toast.success('Signed out successfully')
      navigate('/')
    } else {
      toast.error('Error signing out')
    }
    setMenuOpen(false)
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U'

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        {/* Logo */}
        <Link to="/" className="navbar-logo">TicketWave</Link>

        {/* Desktop nav */}
        <div className="navbar-links-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
          <ul className="navbar-links" style={{ marginRight: '2rem' }}>
            <li>
              <NavLink to="/" end className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}>
                Home
              </NavLink>
            </li>
            <li>
              <NavLink to="/events" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}>
                Events
              </NavLink>
            </li>
            {user && (
              <li>
                <NavLink to="/tickets" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}>
                  <Ticket size={15} /> My Tickets
                </NavLink>
              </li>
            )}
            {isOrganizer && (
              <>
                <li>
                  <NavLink to="/dashboard" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}>
                    <LayoutDashboard size={15} /> Dashboard
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/scanner" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}>
                    <QrCode size={15} /> Scanner
                  </NavLink>
                </li>
              </>
            )}
          </ul>

          <div className="navbar-actions">
            {user ? (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'rgba(124,58,237,0.12)',
                    border: '1px solid rgba(124,58,237,0.25)',
                    borderRadius: '999px',
                    padding: '0.35rem 0.75rem 0.35rem 0.35rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div
                    className="avatar"
                    style={{
                      width: 32, height: 32,
                      fontSize: '0.75rem',
                      background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                      color: '#fff',
                    }}
                  >
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                      : initials
                    }
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-2)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile?.full_name?.split(' ')[0] || 'Account'}
                  </span>
                </button>

                {userMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '0.5rem',
                      minWidth: 200,
                      boxShadow: 'var(--shadow-lg)',
                      zIndex: 500,
                    }}
                  >
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', marginBottom: '0.5rem' }}>
                      <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{profile?.full_name || 'User'}</p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--color-text-3)', marginTop: 2 }}>{user?.email}</p>
                      <span className={`badge badge-${profile?.role === 'organizer' ? 'primary' : 'gray'}`} style={{ marginTop: 6 }}>
                        {profile?.role || 'attendee'}
                      </span>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="btn btn-ghost btn-sm"
                      style={{ width: '100%', justifyContent: 'flex-start', gap: '0.5rem' }}
                    >
                      <LogOut size={14} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/auth" className="btn btn-primary" style={{ gap: '0.4rem' }}>
                <Zap size={15} /> Get Started
              </Link>
            )}
          </div>
        </div>

        {/* Hamburger */}
        <button
          className="hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div
          style={{
            position: 'fixed',
            top: 72,
            left: 0,
            right: 0,
            background: 'rgba(9,9,15,0.98)',
            backdropFilter: 'blur(30px)',
            borderBottom: '1px solid var(--color-border)',
            padding: '1rem',
            zIndex: 'var(--z-dropdown)',
          }}
        >
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[{ to: '/', label: 'Home', end: true }, { to: '/events', label: 'Events' }].map(({ to, label, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}
                  onClick={() => setMenuOpen(false)}>
                  {label}
                </NavLink>
              </li>
            ))}
            {user && (
              <li>
                <NavLink to="/tickets" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}
                  onClick={() => setMenuOpen(false)}>
                  <Ticket size={15} /> My Tickets
                </NavLink>
              </li>
            )}
            {isOrganizer && (
              <>
                <li>
                  <NavLink to="/dashboard" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}
                    onClick={() => setMenuOpen(false)}>
                    <LayoutDashboard size={15} /> Dashboard
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/scanner" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}
                    onClick={() => setMenuOpen(false)}>
                    <QrCode size={15} /> Scanner
                  </NavLink>
                </li>
              </>
            )}
          </ul>
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
            {user ? (
              <button onClick={handleSignOut} className="btn btn-ghost" style={{ width: '100%' }}>
                <LogOut size={15} /> Sign Out
              </button>
            ) : (
              <Link to="/auth" className="btn btn-primary" style={{ width: '100%' }}
                onClick={() => setMenuOpen(false)}>
                Get Started
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
