# 📧 Email Ticket Delivery Setup

This guide sets up automatic ticket email delivery using **Resend** (free: 3,000 emails/month).

---

## Step 1 — Get a Resend API Key (5 minutes)

1. Go to **https://resend.com** and create a free account
2. In the Resend dashboard → **API Keys** → **Create API Key**
3. Copy the key (starts with `re_...`)

---

## Step 2 — Add Secret to Supabase

1. Open **Supabase Dashboard** → your project → **Settings** → **Edge Functions**
2. Click **"Add new secret"**
3. Add:
   - Name: `RESEND_API_KEY`
   - Value: `re_xxxxxxxxxxxxxxxx` (your key from Step 1)
4. Also add:
   - Name: `APP_URL`
   - Value: `https://your-app.vercel.app` (your Vercel URL)

---

## Step 3 — Verify a Sender Domain (or use Resend's test domain)

**For testing (free, no setup):**
- You can send from `onboarding@resend.dev` to your own email only
- Change `FROM_EMAIL` in `supabase/functions/send-ticket-email/index.ts` to: `onboarding@resend.dev`

**For production (sends to any email):**
1. In Resend dashboard → **Domains** → **Add Domain**
2. Add your domain (e.g. `ticketwave.ng` or any domain you own)
3. Follow DNS setup instructions
4. Update `FROM_EMAIL` in the function to `tickets@yourdomain.com`

---

## Step 4 — Install Supabase CLI

```bash
npm install -g supabase
supabase login
```

---

## Step 5 — Deploy the Edge Function

```bash
supabase functions deploy send-ticket-email --project-ref oozmihvtxbcadnqliypq
```

Your project ref is `oozmihvtxbcadnqliypq` (from your Supabase URL).

---

## Step 6 — Create the Database Webhook (triggers email on ticket purchase)

1. Supabase Dashboard → **Database** → **Webhooks** → **Create a new hook**
2. Fill in:
   - **Name**: `send-ticket-email`
   - **Table**: `tickets`
   - **Events**: ✅ `INSERT` only
   - **Type**: Supabase Edge Functions
   - **Edge Function**: `send-ticket-email`
3. Click **Confirm**

That's it! Every time a ticket is created, the attendee automatically gets an email with:
- Event details (name, date, time, location)
- Their name and ticket type
- A scannable QR code
- A "View My Ticket" button linking to the app
- Online event join link (if applicable)

---

## Testing

After setup, buy a test ticket on your app — you should receive the email within seconds.

To test without buying:
```bash
# Insert a test ticket manually in Supabase SQL Editor
INSERT INTO tickets (event_id, attendee_id, status) 
VALUES ('your-event-id', auth.uid(), 'active');
```

---

## Troubleshooting

- **Emails not sending**: Check Supabase → Edge Functions → Logs for errors
- **"Invalid API key"**: Double-check the `RESEND_API_KEY` secret in Supabase settings
- **"Domain not verified"**: Use `onboarding@resend.dev` as FROM for testing

