# LeaseFlow OS — Deployment Guide

Production-grade commercial lease operations platform.
Stack: Node.js · Express · PostgreSQL · Vanilla JS SPA

---

## 1. QUICK DEPLOY — RAILWAY (Recommended, 10 minutes)

Railway gives you a Postgres database + Node server in one click.

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "LeaseFlow OS v2 — initial deploy"
git remote add origin https://github.com/YOUR_USERNAME/leaseflow-os.git
git push -u origin main
```

### Step 2 — Deploy on Railway
1. Go to https://railway.app and sign in
2. Click **New Project → Deploy from GitHub repo**
3. Select your `leaseflow-os` repo
4. Railway auto-detects Node.js and starts deploying

### Step 3 — Add PostgreSQL
1. In your Railway project, click **+ New**
2. Select **Database → Add PostgreSQL**
3. Railway auto-injects `DATABASE_URL` into your service

### Step 4 — Set Environment Variables
In Railway → your service → **Variables** tab, add:
```
JWT_SECRET=your-super-secret-key-minimum-32-characters-long
JWT_EXPIRES=8h
NODE_ENV=production
```

### Step 5 — Run Database Setup
In Railway → your service → **Shell** tab:
```bash
npm run migrate
npm run seed
```

### Step 6 — Access Your App
Railway gives you a URL like `https://leaseflow-os-production.up.railway.app`

**Login credentials after seed:**
- Email: `admin@leaseflow.com`
- Password: `Admin1234!`

> Change the password immediately in Settings after first login.

---

## 2. DEPLOY — RENDER (Free tier available)

### Step 1 — Create Web Service
1. Go to https://render.com → New → Web Service
2. Connect your GitHub repo
3. Set:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node

### Step 2 — Create PostgreSQL Database
1. Render dashboard → New → PostgreSQL
2. Copy the **Internal Database URL**

### Step 3 — Environment Variables
In your Render web service → Environment:
```
DATABASE_URL=<paste internal database URL>
JWT_SECRET=your-secret-key-here
NODE_ENV=production
```

### Step 4 — Run Migrations
In Render → your service → Shell:
```bash
node db/migrate.js
node db/seed.js
```

---

## 3. DEPLOY — DOCKER (Any VPS: DigitalOcean, Linode, Hetzner)

### Build and run
```bash
# Build
docker build -t leaseflow-os .

# Run (replace with your real DATABASE_URL)
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/leaseflow \
  -e JWT_SECRET=your-secret-key \
  -e NODE_ENV=production \
  --name leaseflow \
  leaseflow-os
```

### With docker-compose (recommended for VPS)
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://lf:lfpass@db:5432/leaseflow
      JWT_SECRET: your-secret-key-here
      NODE_ENV: production
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: lf
      POSTGRES_PASSWORD: lfpass
      POSTGRES_DB: leaseflow
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pgdata:
```

```bash
docker-compose up -d
docker-compose exec app node db/migrate.js
docker-compose exec app node db/seed.js
```

---

## 4. LOCAL DEVELOPMENT

```bash
# Install dependencies
npm install

# Create .env from template
cp .env.example .env
# Edit .env and set DATABASE_URL to your local postgres

# Run migrations and seed
npm run migrate
npm run seed

# Start dev server with auto-reload
npm run dev

# App runs at http://localhost:3000
```

---

## 5. ADDING YOUR FIRST REAL CUSTOMER

After deploying, to add a new organization (customer):

1. Connect to your database via psql or any GUI (TablePlus, DBeaver)
2. Run:
```sql
-- Create the organization
INSERT INTO organizations (id, name, slug, currency, timezone, tax_rate, email)
VALUES (uuid_generate_v4(), 'Your Customer Name', 'customer-slug', 'USD', 'America/New_York', 8.5, 'admin@customer.com');

-- Note the org id returned, then create their admin user
-- Password below is "Admin1234!" — customer should change on first login
INSERT INTO users (id, org_id, email, password_hash, name, role)
VALUES (
  uuid_generate_v4(),
  '<org-id-from-above>',
  'admin@customer.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- Admin1234!
  'Admin User',
  'secretary'
);
```
3. Send them the URL and credentials.

---

## 6. API REFERENCE

All routes require `Authorization: Bearer <token>` except `/api/auth/login`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login → returns JWT token |
| GET | `/api/auth/me` | Get current user profile |
| GET | `/api/dashboard/stats` | MRR, occupancy, overdue totals |
| GET | `/api/tenants` | List all tenants with contract info |
| GET | `/api/tenants/:id` | Single tenant details |
| POST | `/api/tenants` | Onboard tenant + create contract |
| GET | `/api/tenants/:id/ledger` | Full invoice + payment history |
| GET | `/api/contracts` | All contracts |
| PATCH | `/api/contracts/:id/escalate` | Apply rent escalation |
| GET | `/api/invoices` | List invoices (filter by status/tenant) |
| POST | `/api/invoices` | Create invoice |
| PATCH | `/api/invoices/:id/status` | Update invoice status |
| GET | `/api/payments` | List payments |
| POST | `/api/payments` | Record payment (auto-matches invoice) |
| GET | `/api/reports/rent-roll` | Rent roll report |
| GET | `/api/reports/aging` | Aging receivables report |
| GET | `/api/audit` | Audit log |
| GET | `/api/notifications` | User notifications |
| PATCH | `/api/notifications/read-all` | Mark all read |
| GET | `/health` | Health check (no auth) |

---

## 7. ARCHITECTURE OVERVIEW

```
leaseflow-os/
├── server.js           ← Express entry point, all middleware
├── routes/
│   ├── auth.js         ← Login, change password
│   ├── tenants.js      ← Tenant CRUD, onboarding, ledger
│   └── invoices.js     ← Invoices, payments, contracts, dashboard
├── middleware/
│   └── auth.js         ← JWT verification, role guard
├── db/
│   ├── pool.js         ← PostgreSQL connection pool
│   ├── audit.js        ← Audit log helper
│   ├── schema.sql      ← Full normalized schema
│   ├── migrate.js      ← Runs schema.sql
│   └── seed.js         ← Demo data loader
├── public/
│   └── index.html      ← Full SPA frontend (no build step needed)
├── package.json
├── Dockerfile
├── railway.json
└── .env.example
```

**Data flow:**
- Browser → `GET /` → `public/index.html` (SPA loads)
- SPA login → `POST /api/auth/login` → JWT stored in localStorage
- All subsequent API calls carry `Authorization: Bearer <token>`
- Server validates JWT, extracts `org_id`, all queries scoped to that org
- PostgreSQL enforces data isolation per organization

---

## 8. WHAT'S IN THE DATABASE

After `npm run seed` you get:

- 1 organization (Peninsula Tower Management Co)
- 1 user (admin@leaseflow.com / Admin1234!)
- 6 tenants with realistic data
- 1 property + building + units
- 6 active contracts (3 active, 2 expiring, 1 long-term)
- 8 invoices (mix of paid, sent, overdue)
- 3 sample payments
- 4 audit log entries

---

## 9. SECURITY CHECKLIST BEFORE GOING LIVE

- [ ] Change `JWT_SECRET` to a random 64-char string
- [ ] Change seed admin password immediately after first login
- [ ] Set `ALLOWED_ORIGINS` to your actual domain only
- [ ] Enable SSL on your database (Railway/Render do this automatically)
- [ ] Set up automated daily backups (Railway: built-in, Render: enable in dashboard)
- [ ] Put app behind Cloudflare (free DDoS protection + SSL)
- [ ] Remove or restrict the `/api/auth` route if not using multi-org

---

## 10. NEXT STAGES (ROADMAP)

**Stage 3 — Email automation (3 weeks)**
- Resend API integration for invoice delivery
- Auto-reminders on overdue invoices
- Contract renewal notifications
- Add `RESEND_API_KEY` to `.env`

**Stage 4 — PDF storage (2 weeks)**
- Server-side PDF generation (Puppeteer)
- Supabase Storage for invoice archive
- Downloadable rent rolls and statements

**Stage 5 — Tenant portal (4 weeks)**
- Separate login for tenants
- View invoices, download PDFs
- Pay online via Stripe

**Stage 6 — Full onboarding wizard (2 weeks)**
- Connect the existing HTML wizard to the `POST /api/tenants` endpoint
- Unit selector from live database
- Automated first invoice on finalize
