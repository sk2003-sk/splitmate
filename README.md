# SplitMate

A MERN expense splitter with two independent experiences:

- **Public splits (no account):** anyone can open the site, add the people they went out with, log who paid for what, and see exactly who owes whom. Every split has a shareable link.
- **Ledger (optional account):** groups, recurring expenses, settlements, analytics, activity and notifications for people who want a persistent ledger.

The UI uses a Netflix-style dark theme (black canvas, `#E50914` accents, condensed uppercase display type).

## Stack

- **Client:** React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, React Router, Framer Motion, Recharts, sonner
- **Server:** Node/Express (ESM), Mongoose, JWT in an httpOnly cookie, bcrypt, zod, helmet, express-rate-limit
- **Database:** MongoDB

Money is stored as integer **paise**, so splits are exact; the largest-remainder method distributes any leftover paise.

## Getting started

### 1. MongoDB

Local development uses a standard MongoDB on port 27017. With Homebrew:

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

The default database is `mongodb://127.0.0.1:27017/splitmate`. The data directory is managed by the Homebrew service (`/opt/homebrew/var/mongodb` on Apple Silicon); no custom `dbPath` is required.

> The database starts empty. There is no seed data — people add their own splits. If you ever want the old demo ledger back, `npm run seed` in `server/` recreates sample users, groups and expenses (use `npm run seed -- --reset` to wipe collections first).

### 2. Server

```bash
cd server
cp .env.example .env        # then edit values
npm install
npm run dev                 # http://localhost:5001
```

`server/.env` keys:

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (default `5001`) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string; required in production |
| `CLIENT_URL` | Allowed CORS origin(s), comma-separated |
| `ALLOW_DEMO_LOGIN` | Only for local demos; must be `false` in production |
| `DEMO_PASSWORD` | Password for demo accounts (only if demo login is on) |
| `INBOUND_EMAIL_DOMAIN` | Domain for per-user ingest addresses, e.g. `inbox.splitmate.app` (optional) |
| `INBOUND_EMAIL_SECRET` | Shared secret the email provider must send on the inbound webhook (optional) |

### 3. Client

```bash
cd client
npm install
npm run dev                 # http://localhost:5173
```

`VITE_API_URL` can stay empty in development; the Vite dev server proxies `/api` to `http://localhost:5001`.

### Checks

```bash
cd client && npx tsc --noEmit && npm run build
curl http://localhost:5001/api/health
```

There is no automated server test suite checked in; the health endpoint confirms API and database connectivity.

## Public splits (no login)

Routes:

| Route | What it does |
| --- | --- |
| `/` | Public board listing recent splits, with a "New split" call to action |
| `/split/new` | Name the outing, add people by name |
| `/split/:code` | The split workspace |
| `/splits` | Same board (linked from the header) |

Inside `/split/:code` you can:

- Add or remove people (a person can only be removed once their expenses are gone).
- Log a payment: description, amount, who paid, date, and who shares it.
- See each person's per-head share before saving.
- Read **Who pays whom** (simplified transfers) and **Net balances**.
- Copy the share link, rename the split, or delete it.

Public splits are link-shared by design: anyone holding the URL can view and edit that split. Do not put anything private in a public split.

### Public API

All under `/api/public/splits`, no authentication:

| Method | Path | Body |
| --- | --- | --- |
| `GET` | `/` | — (recent splits summary) |
| `POST` | `/` | `{ title, people: ["Name", …] }` |
| `GET` | `/:code` | — (split + computed summary) |
| `PATCH` | `/:code` | `{ title? , addPeople?: ["Name"] }` |
| `DELETE` | `/:code` | — |
| `POST` | `/:code/expenses` | `{ description, amount, paidBy, participants: [personKey], date? }` |
| `DELETE` | `/:code/expenses/:expenseId` | — |
| `DELETE` | `/:code/people/:personKey` | — (409 if the person is on an expense) |

Reads return `{ split, summary }`, where `summary` contains the total, per-person balances and simplified transfers. Writes are rate-limited per device.

## Ledger (optional account)

`/login` and `/register` unlock the authenticated app: dashboard, all payments, groups, expenses, balances, settlements, analytics, activity, notifications and profile. Ledger data is scoped to the signed-in account and its groups. Signing out returns to the public split board, so the no-login flow always stays the front door.

Analytics (`/analytics`) supports week, month, quarter, year and custom ranges, plus a **Year in spending** card with a daily heatmap, 12-month totals, active days and monthly average. The authenticated endpoints behind it are:

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/analytics/summary` | Lifetime totals and current balance |
| `GET` | `/api/analytics/monthly` | Monthly buckets for `from`/`to` (or the last `months` months) |
| `GET` | `/api/analytics/weekly` | Weekly buckets in the range |
| `GET` | `/api/analytics/daily` | One row per day in the range (max 400 days) |
| `GET` | `/api/analytics/categories` | Category totals and your share |
| `GET` | `/api/analytics/members` | Paid vs share per member |
| `GET` | `/api/analytics/groups` | Spend by group |
| `GET` | `/api/reports/monthly?month=YYYY-MM` | Downloadable CSV for one month |

All accept optional `from`, `to` and `groupId` query parameters.

Settlements (`/settlements`) record payments you report. For UPI the app builds a `upi://pay?...` deep link for the recipient's UPI ID, then asks you to confirm the payment with a UTR/transaction reference and an optional screenshot or receipt. The confirmation is stored as `reference` and `receiptUrl` on the settlement. This is user-reported only — SplitMate never verifies it with a bank or payment app. Reversing a settlement restores balances and keeps the audit trail.

### All payments (`/payments`)

The personal tracker covers every payment you make, not just splits: GPay, PhonePe, Slice, Paytm, bank/NEFT, cash or other, in either direction (paid or received). Payment apps do not expose transaction history to third parties, so you log a payment in seconds and can attach a screenshot or receipt — or forward your bank alert emails/SMS and let the inbound parser capture them (see below). Totals are grouped by month and by app for the year, with filters and delete. On the first sign-in the app offers to turn tracking on — the choice is saved on the user (`trackPayments`, `paymentPromptSeen`). This is a private record built from user input and forwarded emails; SplitMate never claims a bank or app verified it.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/payments` | Paginated list; optional `month=YYYY-MM`, `app`, `direction`, `from`, `to` |
| `GET` | `/api/payments/summary?year=YYYY` | Year totals, 12 monthly buckets and per-app totals |
| `POST` | `/api/payments` | `{ payee, amount, app, direction, category, paidAt, note, receiptUrl }` |
| `PUT` | `/api/payments/:id` | Update one of your payments |
| `DELETE` | `/api/payments/:id` | Delete one of your payments |

`POST` accepts an `Idempotency-Key` header so a retried save does not create a duplicate. Receipts use the same image/PDF upload endpoint as settlements.

### Automatic capture by forwarded email

Payment apps don't expose transaction history, but your bank emails you on every UPI/card debit. SplitMate can parse those alerts so new payments appear without typing. This works on iPhone too — iOS blocks SMS and notification reading, but forwarding an email is allowed.

Setup:

1. Set `INBOUND_EMAIL_DOMAIN` (e.g. `inbox.splitmate.app`) and a long random `INBOUND_EMAIL_SECRET` in `server/.env`. Every other route works without them; only capture stays disabled.
2. Point your email provider's inbound route at `POST https://<your-api-host>/api/inbound/email` and send the secret as `X-SplitMate-Secret: <secret>` (or as the HTTP Basic password). SendGrid Inbound Parse, Mailgun Routes, Postmark Inbound and generic JSON webhooks all work — the route accepts JSON, form-encoded and multipart bodies.
3. In the app open **Settings → Automatic capture by email → Create forwarding address**. Each user gets a private address `u-<token>@<domain>`.
4. Forward (or auto-forward) bank alert emails to that address from Gmail/Outlook.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/capture/email` | Current address and whether the server is configured |
| `POST` | `/api/capture/email` | Create the address (idempotent) |
| `POST` | `/api/capture/email/rotate` | Invalidate the old address and issue a new token |
| `DELETE` | `/api/capture/email` | Stop capture; the old address is rejected |
| `GET` | `/api/capture/email/captures` | Last 10 capture attempts with status |
| `POST` | `/api/inbound/email` | Provider webhook (secret required) |

Example webhook call:

```bash
curl -X POST http://localhost:5001/api/inbound/email \
  -H 'Content-Type: application/json' \
  -H 'X-SplitMate-Secret: <secret>' \
  -d '{"to":"u-<token>@inbox.splitmate.app","from":"alerts@hdfcbank.net","subject":"Debit alert","text":"Rs.450.00 debited from A/c XX1234 to VPA metro@okaxis","messageId":"<abc@hdfcbank.net>"}'
```

Accepted payload keys: recipient in `to`/`recipient`/`envelope`; sender in `from`/`sender`; `subject`; `text`/`body-plain`; `html`/`body-html`; `messageId`; `date`. Provider retries are safe — a repeated `Message-ID` (or identical body fingerprint) returns `duplicate` instead of creating a second payment.

The parser recognises bank alerts and ignores OTPs, failed/declined payments, statements, collect requests and marketing. It extracts amount, direction (debit → paid, credit → received), merchant or VPA, app (GPay/PhonePe/Paytm/Slice or bank), category and date. Low-confidence captures are flagged **Needs review** in Payments and can be confirmed or deleted there. Only parsed fields are stored — never the full email body — and the capture audit expires after 90 days. Alert formats it cannot parse are skipped, and nothing is ever claimed as verified by the bank.

### Automatic capture from bank SMS

A browser cannot read SMS, so the phone does the reading and the web app receives the text over HTTPS. On iPhone, a Shortcuts personal automation runs automatically when a bank message arrives:

1. **Settings → Automatic capture from bank SMS → Create token**. Copy it immediately — it is shown once and stored hashed.
2. Shortcuts → Automation → **+** → **Message**; set the sender filter (HDFCBK, HDFCBN, ICICIB, SBIINB, AXISBK, …) and choose **Run Immediately**.
3. Add **Get text from Shortcut Input**, then **Get Contents of URL**: POST to `https://<api-host>/api/inbound/sms`, header `Content-Type: application/json`, JSON body `{ "token": "<token>", "text": "<message text>", "sender": "<sender>" }`.
4. Send a test alert; it appears in Payments with an **Auto · SMS** badge.

Android users can point any SMS-forwarding app (Tasker, an SMS-to-URL forwarder) at the same endpoint with the same token. No SplitMate app install is needed on either platform; the token identifies the account, is rate-limited, and stops working immediately when rotated or turned off.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/capture/sms` | Whether SMS capture is on and the endpoint path |
| `POST` | `/api/capture/sms` | Create a token (returns it once; no token if already enabled) |
| `POST` | `/api/capture/sms/rotate` | Replace the token; the old one stops working |
| `DELETE` | `/api/capture/sms` | Turn off; the old token gets `401` |
| `GET` | `/api/capture/sms/captures` | Last 10 SMS attempts |

Example:

```bash
curl -X POST http://localhost:5001/api/inbound/sms \
  -H 'Content-Type: application/json' \
  -d '{"token":"<64-hex token>","sender":"HDFCBK","text":"Rs.450.00 debited from A/c XX1234 on 22-11-26 to VPA metro@okaxis. Avl Bal Rs.9000.00"}'
```

The same parser, duplicate protection (an identical sender + text returns `duplicate`) and Needs-review flow apply. Messages are not stored in full, OTPs and failed payments are ignored, and the token can only write to its owner's account. Use email or SMS per bank, not both, to avoid duplicate payments.


## Deploying to production

Production is two services plus a hosted database:

| Piece | Host | Notes |
| --- | --- | --- |
| API | Render web service (`render.yaml`) | Node/Express, `/api/health` health check |
| Client | Vercel static build (`vercel.json`) | Vite build from `client/`, SPA fallback |
| Database | MongoDB Atlas | Free M0 is enough to start |
| Repo | GitHub | Render and Vercel both auto-deploy from `main` |

### 1. Database (MongoDB Atlas)

Create a free cluster, a database user and a password, then allow Render to connect (`0.0.0.0/0` in Network Access). Copy the connection string, e.g. `mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/splitmate`. Keep the database name `splitmate`. Never commit it.

### 2. API (Render)

1. New → Blueprint → connect this repository. Render reads `render.yaml` and creates `splitmate-api`.
2. Enter the secret values when prompted:
   - `MONGODB_URI` — the Atlas string above
   - `CLIENT_URL` — the Vercel URL (can be filled after step 3)
   - `INBOUND_EMAIL_DOMAIN` / `INBOUND_EMAIL_SECRET` — optional, only for email capture
3. `JWT_SECRET` is generated by Render, `ALLOW_DEMO_LOGIN=false` is set in the blueprint, and the seed script refuses to run when `NODE_ENV=production`.

The service starts with `npm ci && npm start` inside `server/`. Render’s free filesystem is ephemeral: uploaded receipts disappear on restart or redeploy. Attach a paid persistent disk (mount at `/opt/render/project/src/server/uploads`) or move uploads to object storage before relying on receipts in production.

### 3. Client (Vercel)

1. Import the same repository in Vercel. The root `vercel.json` installs and builds `client/` and serves `client/dist`.
2. Leave `VITE_API_URL` empty. Instead, proxy the API through Vercel so the browser sees one origin — the auth cookie is `httpOnly` + `sameSite=lax` and would otherwise be dropped cross-site. After Render gives you the API URL, add these rewrites to `vercel.json` above the SPA fallback:

```json
"rewrites": [
  { "source": "/api/:path*", "destination": "https://<your-service>.onrender.com/api/:path*" },
  { "source": "/uploads/:path*", "destination": "https://<your-service>.onrender.com/uploads/:path*" },
  { "source": "/((?!api/|uploads/).*)", "destination": "/index.html" }
]
```

3. Set `CLIENT_URL` on Render to the Vercel production URL and redeploy the API so CORS and cookie settings line up.
4. Custom domains work too; add each origin to `CLIENT_URL` (comma-separated).

### 4. Post-deploy checks

```bash
curl https://<your-service>.onrender.com/api/health          # {"status":"ok","database":"connected"}
```

Then open the Vercel URL and verify: register/login, create a public split, log a payment, and (optional) send an SMS test to `https://<your-service>.onrender.com/api/inbound/sms`. The database starts empty — demo seed accounts only exist locally and cannot be created in production.

## Security notes

- JWT is sent in an httpOnly cookie; passwords are bcrypt-hashed.
- Auth secrets and demo passwords are never sent to the client; `ALLOW_DEMO_LOGIN` must be disabled in production.
- Requests are validated with zod, rate-limited globally and on public writes, and CORS is restricted to `CLIENT_URL`.
- Uploads are size/type limited and access to ledger data is checked per account.
- Settlement confirmations (UTR/reference and receipts) are user-reported labels — SplitMate never claims that money actually moved through UPI or a bank.
- Logged payments are a private personal record. SplitMate never reads bank or payment-app history, never asks for a UPI PIN, bank login or app password, and every payment query is scoped to the signed-in user.
- The inbound email webhook requires `INBOUND_EMAIL_SECRET` (compared in constant time), is rate-limited, and only writes to the user whose private address received the email. SMS ingest tokens are 256-bit random values stored only as SHA-256 hashes, are rate-limited, and can be rotated or revoked at any time. Raw email bodies are not stored, OTPs and failed notifications are ignored, and the capture audit expires after 90 days.
