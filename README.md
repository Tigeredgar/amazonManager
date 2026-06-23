# Return Window

A private Amazon order, return-deadline, and refund tracker built with Next.js, Clerk, Gmail, Neon Postgres, and Vercel Cron.

## What it does

- Imports Amazon `Ordered`, `Shipped`, `Delivered`, return-request, dropoff, and refund emails.
- Tracks each item independently across split shipments and partial returns.
- Calculates a clearly labeled estimated return deadline 30 calendar days after delivery.
- Sends one Gmail digest at 7, 3, and 1 days before eligibility and dropoff deadlines.
- Sends a one-time alert when a promised refund becomes overdue.
- Preserves ambiguous matches in a review queue instead of guessing.
- Archives finalized items and suppresses their reminders.

The app does not scrape Amazon or store Amazon credentials, cookies, complete email bodies, or full payment details.

## Local development

Requirements: Node.js 20.19+, 22.13+, or 24+ and npm.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Leave `DEMO_MODE=true` to use the anonymized local dataset without cloud services. Production always disables demo mode and fails closed when credentials are missing.

Quality checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Production setup

### 1. Vercel, Clerk, and Neon

1. Import the repository into Vercel.
2. Install Clerk and Neon from the Vercel Marketplace.
3. Enable Google sign-in in Clerk.
4. Set `ALLOWED_EMAILS` to the two comma-separated Google accounts that may access the dashboard.
5. Generate `CRON_SECRET` with `openssl rand -base64 32`.
6. Pull local environment variables after linking the project:

```bash
vercel link
vercel env pull .env.local --yes
```

Apply the generated migration:

```bash
npm run db:migrate
```

### 2. Google OAuth for Gmail

Create a separate Google OAuth web application for mailbox access. This grant is intentionally separate from Clerk dashboard sign-in.

1. Enable the Gmail API in Google Cloud.
2. Configure an external OAuth consent screen and publish it as **In production**. For a personal app with fewer than 100 users, users may continue through Google’s unverified-app warning.
3. Add only these scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
4. Add redirect URIs:
   - Local: `http://localhost:3000/api/oauth/google/callback`
   - Production: `https://YOUR_DOMAIN/api/oauth/google/callback`
5. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the matching `GOOGLE_REDIRECT_URI` to Vercel.
6. Generate the token encryption key with `openssl rand -base64 32` and store it as `GMAIL_TOKEN_ENCRYPTION_KEY`.
7. Set `APP_URL` and `REMINDER_RECIPIENTS`.

Do not commit the downloaded Google credential JSON. Copy only its client ID and client secret into Vercel’s encrypted environment variables.

### 3. Connect and import

1. Sign in to the deployed app using an allowlisted account.
2. Open **Settings → Connect Gmail** and have the Amazon mailbox owner approve the grant.
3. Return to the dashboard and run **Sync now**. Imports are processed in pages of 50; continue syncing while the dashboard indicates more history is available.
4. Review ambiguous messages before relying on the affected item state.
5. Verify reminder delivery with an item deadline set to one of the configured threshold dates.

Vercel invokes `/api/cron/daily` at 14:00 UTC. The route requires Vercel’s `Authorization: Bearer $CRON_SECRET` header, syncs Gmail first, and then evaluates reminders.

## Data model

The Drizzle schema includes orders, items, shipments, returns, mailbox connections, source email events, parser reviews, notification batches, and notification entries. OAuth refresh tokens are encrypted with AES-256-GCM before being written to Neon.

Raw message bodies are parsed in memory and discarded. Reprocessing uses the retained Gmail message ID to fetch the source again.

## Limitations

- The calculated 30-day return date is an estimate. Amazon holiday extensions and item-specific policies require a manual override.
- The initial parser targets English-language Amazon.com US email formats.
- Return initiation still occurs on Amazon; this app only links to the relevant Amazon page.
- OAuth refresh tokens can be revoked or invalidated. The settings page exposes connection and last-sync health so the mailbox can be reconnected.
