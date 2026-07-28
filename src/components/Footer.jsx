import { Link } from 'react-router-dom'
import { Zap } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link to="/" style={{ display: 'inline-block' }}>
              <span className="navbar-logo">TicketWave</span>
            </Link>
            <p className="footer-brand-desc">
              Nigeria's most powerful event ticketing platform. Buy and sell tickets with instant QR delivery — supporting all Nigerian payment methods.
            </p>
          </div>

          <div>
            <h4 className="footer-heading">Discover</h4>
            <ul className="footer-links">
              <li><Link to="/events" className="footer-link">Browse Events</Link></li>
              <li><Link to="/events?type=online" className="footer-link">Online Events</Link></li>
              <li><Link to="/events?type=physical" className="footer-link">Physical Events</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="footer-heading">Organizers</h4>
            <ul className="footer-links">
              <li><Link to="/dashboard" className="footer-link">Dashboard</Link></li>
              <li><Link to="/scanner" className="footer-link">QR Scanner</Link></li>
              <li><Link to="/auth" className="footer-link">Create Account</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="footer-heading">Support</h4>
            <ul className="footer-links">
              <li><a href="mailto:hello@ticketwave.ng" className="footer-link">Contact Us</a></li>
              <li><a href="#" className="footer-link">Privacy Policy</a></li>
              <li><a href="#" className="footer-link">Terms of Service</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2026 TicketWave. Built in Nigeria 🇳🇬</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Zap size={12} style={{ color: 'var(--color-primary-light)' }} />
              Powered by Paystack & Supabase
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
