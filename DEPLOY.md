# PropFirm Platform - Railway Deployment Guide

## Quick Fix Checklist (Your Current Issues)

Based on your Railway dashboard, here's what needs to be fixed:

### 1. ❌ Delete Extra PostgreSQL Instances
You have 3 PostgreSQL databases - you only need **1**. Delete `Postgres-XaWK` and `Postgres-tLkV`, keep just `Postgres`.

### 2. ❌ Add Redis (REQUIRED!)
Your trading-engine REQUIRES Redis but it's missing!
1. Click **+ Create** → **Database** → **Redis**
2. Wait for it to deploy
3. Copy the `REDIS_URL` from Variables tab

### 3. ❌ Fix Environment Variables

#### For API service:
```
DATABASE_URL=<copy from Postgres service>
REDIS_URL=<copy from Redis service>
JWT_SECRET=<generate: openssl rand -base64 32>
NODE_ENV=production
FRONTEND_URL=https://<your-web-domain>.up.railway.app
```

#### For Trading Engine service:
```
DATABASE_URL=<same as API>
REDIS_URL=<same as API>
JWT_SECRET=<same as API - MUST MATCH>
NODE_ENV=production
```

#### For Web service (IMPORTANT - also add as Build Args!):
Go to **Settings** → scroll to **Build** section → add these as **Build Arguments**:
```
NEXT_PUBLIC_API_URL=https://<your-api-domain>.up.railway.app
NEXT_PUBLIC_WS_URL=wss://<your-trading-engine-domain>.up.railway.app
```

Also add them as regular **Variables**:
```
NEXT_PUBLIC_API_URL=https://<your-api-domain>.up.railway.app
NEXT_PUBLIC_WS_URL=wss://<your-trading-engine-domain>.up.railway.app
```

### 4. Generate Domains
For each service (API, Trading Engine, Web):
1. Go to service → **Settings** → **Networking**
2. Click **Generate Domain**

### 5. Redeploy Services
After fixing variables:
1. Redeploy **trading-engine** first
2. Then redeploy **web**

---

## Full Deployment Guide (Starting Fresh)

### Prerequisites
1. **GitHub Account** - Your code needs to be on GitHub
2. **Railway Account** - Sign up at https://railway.app

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Fix Railway deployment"
git push origin main
```

### Step 2: Create Railway Project
1. Go to https://railway.app
2. Click **"Start a New Project"** → **"Empty Project"**

### Step 3: Add PostgreSQL
1. Click **+ New** → **Database** → **PostgreSQL**
2. Copy `DATABASE_URL` from Variables tab

### Step 4: Add Redis
1. Click **+ New** → **Database** → **Redis**
2. Copy `REDIS_URL` from Variables tab

### Step 5: Deploy API
1. Click **+ New** → **GitHub Repo** → Select your repo
2. Set **Root Directory:** `apps/api`
3. Add Variables:
   - `DATABASE_URL` (from PostgreSQL)
   - `REDIS_URL` (from Redis)
   - `JWT_SECRET` (generate one)
   - `NODE_ENV=production`
   - `FRONTEND_URL` (add after web is deployed)
4. Generate domain in Settings → Networking

### Step 6: Deploy Trading Engine
1. Click **+ New** → **GitHub Repo** → Select your repo
2. Set **Root Directory:** `apps/trading-engine`
3. Add Variables (same as API):
   - `DATABASE_URL`
   - `REDIS_URL`
   - `JWT_SECRET` (SAME as API!)
   - `NODE_ENV=production`
4. Generate domain in Settings → Networking

### Step 7: Deploy Web
1. Click **+ New** → **GitHub Repo** → Select your repo
2. Set **Root Directory:** `apps/web`
3. **IMPORTANT:** Go to Settings → Build section, add Build Arguments:
   - `NEXT_PUBLIC_API_URL=https://<api-domain>.up.railway.app`
   - `NEXT_PUBLIC_WS_URL=wss://<trading-engine-domain>.up.railway.app`
4. Also add same vars as regular Variables
5. Generate domain in Settings → Networking

### Step 8: Update API FRONTEND_URL
Go back to API service and set:
```
FRONTEND_URL=https://<web-domain>.up.railway.app
```

### Step 9: Run Database Migrations
Option A - Via Railway CLI:
```bash
npm install -g @railway/cli
railway login
railway link
railway run --service api bun run db:migrate
railway run --service api bun run db:seed
```

Option B - Temporary start command:
1. Go to API service → Settings
2. Set Custom Start Command: `bun run db:migrate && bun run db:seed && bun run dist/index.js`
3. Redeploy
4. After success, change back to: `bun run dist/index.js`

---

## Troubleshooting

### Web Build Failed
- Check that `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` are set as **Build Arguments** (not just Variables)
- These must be set BEFORE building because Next.js bakes them into the bundle

### Trading Engine Offline
- Check Redis is deployed and `REDIS_URL` is set
- Check `JWT_SECRET` matches the API service

### WebSocket Not Connecting
- Ensure `NEXT_PUBLIC_WS_URL` uses `wss://` (not `ws://`)
- Check trading-engine has a domain generated
- Verify JWT_SECRET matches between API and Trading Engine

### CORS Errors
- Set `FRONTEND_URL` in API to match your web domain exactly (include `https://`)

---

## Environment Variables Reference

| Service | Variable | Required | Notes |
|---------|----------|----------|-------|
| API | DATABASE_URL | Yes | From PostgreSQL |
| API | REDIS_URL | Yes | From Redis |
| API | JWT_SECRET | Yes | 32+ chars, generate with `openssl rand -base64 32` |
| API | NODE_ENV | Yes | `production` |
| API | FRONTEND_URL | Yes | Your web app URL for CORS |
| Trading Engine | DATABASE_URL | Yes | Same as API |
| Trading Engine | REDIS_URL | Yes | Same as API |
| Trading Engine | JWT_SECRET | Yes | **MUST** match API |
| Trading Engine | NODE_ENV | Yes | `production` |
| Web | NEXT_PUBLIC_API_URL | Yes | API URL (also as Build Arg!) |
| Web | NEXT_PUBLIC_WS_URL | Yes | Trading Engine URL (also as Build Arg!) |

---

## Costs
Railway pricing (as of 2024):
- **Free Tier:** $5/month credit
- **Usage-based:** ~$0.000231/min per service

For a demo with light usage, expect $5-15/month.
