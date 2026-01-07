# PropFirm Platform Deployment Guide

Deploy your trading platform to Railway in ~15 minutes.

## Prerequisites

1. **GitHub Account** - Your code needs to be on GitHub
2. **Railway Account** - Sign up at https://railway.app (use GitHub login)

## Quick Start

### Step 1: Push Code to GitHub

If not already done:
```bash
# Initialize git (if needed)
git init
git add .
git commit -m "Initial commit"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/propfirm-platform.git
git branch -M main
git push -u origin main
```

### Step 2: Create Railway Project

1. Go to https://railway.app
2. Click **"Start a New Project"**
3. Select **"Empty Project"**

### Step 3: Add PostgreSQL Database

1. In your project, click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Wait for it to deploy (~30 seconds)
4. Click on PostgreSQL service → **"Variables"** tab
5. Copy the `DATABASE_URL` (you'll need it later)

### Step 4: Add Redis

1. Click **"+ New"**
2. Select **"Database"** → **"Redis"**
3. Wait for it to deploy
4. Copy the `REDIS_URL` from Variables tab

### Step 5: Deploy API Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your propfirm repository
3. Railway will ask about the root directory - click **"Configure"**
4. Set these options:
   - **Root Directory:** `apps/api`
   - **Builder:** `Dockerfile`
5. Click **"Deploy"**

6. Go to **"Variables"** tab and add:
```
DATABASE_URL=<paste from PostgreSQL>
REDIS_URL=<paste from Redis>
JWT_SECRET=<generate one below>
NODE_ENV=production
FRONTEND_URL=https://propfirm-web-production.up.railway.app
```

To generate JWT_SECRET, run this in terminal:
```bash
openssl rand -base64 32
```

7. Go to **"Settings"** tab:
   - Under **"Networking"**, click **"Generate Domain"**
   - Note the URL (e.g., `propfirm-api-production.up.railway.app`)

### Step 6: Deploy Trading Engine

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your propfirm repository again
3. Configure:
   - **Root Directory:** `apps/trading-engine`
   - **Builder:** `Dockerfile`
4. Click **"Deploy"**

5. Add Variables (same as API):
```
DATABASE_URL=<paste from PostgreSQL>
REDIS_URL=<paste from Redis>
JWT_SECRET=<same as API>
NODE_ENV=production
```

6. Generate domain in Settings (note the URL)

### Step 7: Deploy Web App

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your propfirm repository
3. Configure:
   - **Root Directory:** `apps/web`
   - **Builder:** `Dockerfile`
4. Click **"Deploy"**

5. Add Variables:
```
NEXT_PUBLIC_API_URL=https://<your-api-domain>.up.railway.app
NEXT_PUBLIC_WS_URL=wss://<your-trading-engine-domain>.up.railway.app
```

6. Generate domain in Settings

### Step 8: Run Database Migrations

1. Click on your **API service**
2. Go to **"Settings"** → scroll to **"Deploy"** section
3. Under **"Custom Start Command"**, temporarily set:
```
bun run db:migrate && bun run dist/index.js
```
4. Redeploy (this runs migrations once)
5. After successful deploy, change back to just:
```
bun run dist/index.js
```

Or use Railway CLI:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migration
railway run --service api bun run db:migrate
```

### Step 9: Verify Deployment

1. **Web App:** Visit your web domain - should see the trading interface
2. **API:** Visit `https://your-api-domain.up.railway.app/health` - should return `{"status":"ok"}`
3. **Trading:** Check WebSocket connection in browser dev tools

## Environment Variables Reference

### API & Trading Engine (shared)
| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `JWT_SECRET` | JWT signing secret (32+ chars) | Yes |
| `NODE_ENV` | `production` | Yes |
| `FRONTEND_URL` | Web app URL (for CORS) | Yes |

### Web App
| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | API endpoint URL | Yes |
| `NEXT_PUBLIC_WS_URL` | WebSocket endpoint URL | Yes |

## Troubleshooting

### Build Fails
- Check that Dockerfile path is correct
- Verify root directory is set properly
- Check build logs for specific errors

### WebSocket Not Connecting
- Ensure `NEXT_PUBLIC_WS_URL` uses `wss://` (not `ws://`)
- Check Trading Engine has a domain generated
- Verify JWT_SECRET matches between API and Trading Engine

### Database Connection Error
- Verify `DATABASE_URL` is copied correctly
- Check PostgreSQL service is running
- Try restarting the API service

### CORS Errors
- Ensure `FRONTEND_URL` in API matches your web app domain exactly
- Include `https://` in the URL

## Costs

Railway pricing (as of 2024):
- **Free Tier:** $5/month credit
- **Usage-based:** ~$0.000231/min per service

For a demo with light usage, expect $0-10/month.

## Custom Domain (Optional)

To use your own domain:
1. Go to service **Settings** → **Networking**
2. Click **"Custom Domain"**
3. Enter your domain (e.g., `app.yourpropfirm.com`)
4. Add the CNAME record to your DNS:
   - Type: CNAME
   - Name: `app` (or your subdomain)
   - Value: `<your-service>.up.railway.app`

## Updating the App

When you push to GitHub:
1. Railway automatically detects changes
2. Rebuilds and redeploys affected services
3. Zero-downtime deployment

To deploy manually:
1. Go to service
2. Click **"Deploy"** → **"Trigger Redeploy"**

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
