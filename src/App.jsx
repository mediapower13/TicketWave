import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import EventsPage from './pages/EventsPage'
import EventDetailPage from './pages/EventDetailPage'
import AuthPage from './pages/AuthPage'
import MyTicketsPage from './pages/MyTicketsPage'
import TicketViewPage from './pages/TicketViewPage'
import DashboardPage from './pages/DashboardPage'
import ScannerPage from './pages/ScannerPage'
import { isSupabaseConfigured } from './lib/supabase'
import './index.css'

function ConfigErrorScreen() {
  return (
    <main className="page" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
      <div className="card" style={{ maxWidth: 680, width: '100%', padding: '2rem' }}>
        <p className="section-eyebrow" style={{ marginBottom: '0.75rem' }}>Deployment setup required</p>
        <h1 className="section-title" style={{ marginTop: 0 }}>Missing Supabase environment variables</h1>
        <p style={{ color: 'var(--color-text-2)', lineHeight: 1.7 }}>
          The app cannot connect to Supabase on Vercel until <strong>VITE_SUPABASE_URL</strong> and
          <strong> VITE_SUPABASE_ANON_KEY</strong> are added to the Vercel project environment variables.
        </p>
        <p style={{ color: 'var(--color-text-3)', lineHeight: 1.7, marginBottom: 0 }}>
          After adding them, redeploy the app. The auth redirects already use the deployed origin or the
          configured <strong>VITE_APP_URL</strong>, so signup and confirmation links will follow the production host.
        </p>
      </div>
    </main>
  )
}

function ProtectedRoute({ children, requireOrganizer = false }) {
  const { user, profile, loading } = useAuth()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => setTimedOut(true), 10000) // 10s max wait
    return () => clearTimeout(t)
  }, [loading])

  if (loading && !timedOut) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
        <p style={{ color: 'var(--color-text-3)', fontSize: '0.9rem' }}>Connecting…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/auth" replace />
  if (requireOrganizer && profile?.role !== 'organizer' && profile?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return children
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/tickets" element={
          <ProtectedRoute>
            <MyTicketsPage />
          </ProtectedRoute>
        } />
        <Route path="/tickets/:id" element={
          <ProtectedRoute>
            <TicketViewPage />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute requireOrganizer>
            <DashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/scanner" element={
          <ProtectedRoute requireOrganizer>
            <ScannerPage />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </>
  )
}

export default function App() {
  if (!isSupabaseConfigured) {
    return <ConfigErrorScreen />
  }

  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a1a2e',
              color: '#f1f0ff',
              border: '1px solid rgba(124,58,237,0.3)',
              borderRadius: '0.75rem',
              fontSize: '0.9rem',
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#f43f5e', secondary: '#fff' },
            },
          }}
        />
      </AuthProvider>
    </Router>
  )
}
