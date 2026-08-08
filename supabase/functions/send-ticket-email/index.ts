// Supabase Edge Function: send-ticket-email
// Sends a QR ticket confirmation email via Resend after a ticket is purchased.
//
// SETUP:
// 1. Create a free account at https://resend.com
// 2. Get your API key from Resend dashboard
// 3. In Supabase dashboard → Settings → Edge Functions → Add Secret:
//    RESEND_API_KEY = re_xxxxxxxxxxxx
// 4. Deploy: supabase functions deploy send-ticket-email --project-ref YOUR_PROJECT_REF
// 5. In Supabase dashboard → Database → Webhooks → Create webhook:
//    Table: tickets, Event: INSERT, URL: https://YOUR_PROJECT.supabase.co/functions/v1/send-ticket-email

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const APP_URL = Deno.env.get('APP_URL') || 'https://ticketwave.vercel.app'
const FROM_EMAIL = 'tickets@ticketwave.ng' // Change to your verified Resend sender domain

serve(async (req) => {
  // Only accept POST from Supabase webhook
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.json()
    // Supabase webhook payload: { type: 'INSERT', table: 'tickets', record: {...} }
    const ticket = body.record

    if (!ticket?.id || !ticket?.attendee_id) {
      return new Response('Missing ticket data', { status: 400 })
    }

    // Create Supabase admin client to fetch joined data
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Fetch full ticket details with event + attendee
    const { data, error } = await supabase
      .from('tickets')
      .select('*, events(title, description, start_at, end_at, location, venue_name, event_type, banner_url, online_link, currency), profiles(full_name, email)')
      .eq('id', ticket.id)
      .single()

    if (error || !data) {
      console.error('Failed to fetch ticket:', error)
      return new Response('Ticket not found', { status: 404 })
    }

    const { events: event, profiles: attendee } = data
    const toEmail = attendee?.email
    const toName = data.attendee_name || attendee?.full_name || 'Attendee'

    if (!toEmail) {
      return new Response('No email address for attendee', { status: 400 })
    }

    // Format dates
    const eventDate = event.start_at
      ? new Date(event.start_at).toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : ''
    const eventTime = event.start_at
      ? new Date(event.start_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
      : ''
    const location = event.venue_name ? `${event.venue_name}${event.location ? ', ' + event.location : ''}` : event.location || ''
    const ticketUrl = `${APP_URL}/tickets/${data.id}`
    const ticketType = data.ticket_type_name || 'General Admission'

    // QR code image URL (using public QR API)
    const qrData = JSON.stringify({ ticketId: data.id, eventId: data.event_id, qrCode: data.qr_code })
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`

    // Build HTML email
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Ticket: ${event.title}</title>
</head>
<body style="margin:0;padding:0;background:#09090f;font-family:'Segoe UI',sans-serif;color:#f1f0ff;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:28px;">
      <p style="font-size:22px;font-weight:900;margin:0;background:linear-gradient(135deg,#8b5cf6,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">🎟 TicketWave</p>
    </div>

    <!-- Ticket card -->
    <div style="background:#1a1a2e;border:1px solid rgba(124,58,237,0.3);border-radius:16px;overflow:hidden;">
      <!-- Purple top bar -->
      <div style="height:4px;background:linear-gradient(90deg,#7c3aed,#a78bfa);"></div>

      <!-- Banner (if exists) -->
      ${event.banner_url ? `<img src="${event.banner_url}" alt="${event.title}" style="width:100%;height:180px;object-fit:cover;display:block;">` : ''}

      <div style="padding:28px 24px;">
        <!-- Type badge -->
        <div style="margin-bottom:12px;">
          <span style="background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);color:#a78bfa;padding:4px 12px;border-radius:99px;font-size:12px;font-weight:600;">🎟 ${ticketType}</span>
        </div>

        <h1 style="font-size:24px;font-weight:900;margin:0 0 16px;color:#f1f0ff;">${event.title}</h1>

        <!-- Event details -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr>
            <td style="padding:6px 0;color:#9ca3af;font-size:13px;width:24px;">📅</td>
            <td style="padding:6px 0;color:#f1f0ff;font-size:14px;font-weight:600;">${eventDate}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#9ca3af;font-size:13px;">🕐</td>
            <td style="padding:6px 0;color:#f1f0ff;font-size:14px;font-weight:600;">${eventTime}</td>
          </tr>
          ${location ? `<tr>
            <td style="padding:6px 0;color:#9ca3af;font-size:13px;">📍</td>
            <td style="padding:6px 0;color:#f1f0ff;font-size:14px;font-weight:600;">${location}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:6px 0;color:#9ca3af;font-size:13px;">👤</td>
            <td style="padding:6px 0;color:#f1f0ff;font-size:14px;font-weight:600;">${toName}</td>
          </tr>
        </table>

        <!-- Dashed divider -->
        <div style="border-top:2px dashed rgba(255,255,255,0.1);margin:0 -8px 20px;"></div>

        <!-- QR Code -->
        <div style="text-align:center;margin-bottom:20px;">
          <div style="background:#fff;border-radius:12px;padding:16px;display:inline-block;margin-bottom:12px;">
            <img src="${qrUrl}" width="180" height="180" alt="QR Code" style="display:block;">
          </div>
          <p style="font-family:monospace;font-size:12px;color:#6b7280;margin:0;letter-spacing:0.08em;">${data.ticket_number}</p>
          <p style="font-size:12px;color:#6b7280;margin:8px 0 0;">Present this QR code at the event entrance</p>
        </div>

        <!-- CTA Button -->
        <div style="text-align:center;">
          <a href="${ticketUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;margin-bottom:12px;">View My Ticket →</a>
        </div>

        ${event.online_link ? `
        <div style="text-align:center;margin-top:12px;">
          <a href="${event.online_link}" style="color:#a78bfa;font-size:13px;">🌐 Join Online Event</a>
        </div>` : ''}
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:24px;color:#6b7280;font-size:12px;line-height:1.6;">
      <p>You received this because you purchased a ticket on TicketWave.</p>
      <p style="margin:4px 0 0;">Questions? Reply to this email or visit <a href="${APP_URL}" style="color:#a78bfa;">${APP_URL}</a></p>
    </div>
  </div>
</body>
</html>`

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `TicketWave <${FROM_EMAIL}>`,
        to: [toEmail],
        subject: `Your ticket for ${event.title} 🎟️`,
        html,
      }),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      console.error('Resend error:', resendData)
      return new Response(JSON.stringify({ error: 'Email send failed', details: resendData }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log(`✅ Ticket email sent to ${toEmail} for ticket ${data.ticket_number}`)
    return new Response(JSON.stringify({ success: true, emailId: resendData.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
