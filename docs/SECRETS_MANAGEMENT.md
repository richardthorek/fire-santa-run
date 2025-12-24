# Secrets Management Guide

This guide explains how to properly manage secrets and API keys for the Fire Santa Run application.

## Table of Contents
1. [Required Secrets](#required-secrets)
2. [Local Development Setup](#local-development-setup)
3. [GitHub Actions Setup](#github-actions-setup)
4. [Deployment Setup](#deployment-setup)
5. [Security Best Practices](#security-best-practices)
6. [Secret Rotation](#secret-rotation)
7. [Troubleshooting](#troubleshooting)

---

## Required Secrets

### 1. Mapbox API Token (REQUIRED)

**Purpose:** Display interactive maps using Mapbox GL JS

**How to obtain:**
1. Sign up at [Mapbox](https://account.mapbox.com/auth/signup/)
2. Go to [Access Tokens](https://account.mapbox.com/access-tokens/)
3. Click "Create a token"
4. Name it "Fire Santa Run"
5. Enable these scopes:
   - ✅ `styles:read`
   - ✅ `fonts:read`
   - ✅ `datasets:read` (optional)
6. Restrict URL (recommended):
   - Add your domain: `https://your-domain.com/*`
   - Add localhost: `http://localhost:5173/*`
7. Click "Create token"
8. Copy the token (starts with `pk.`)

**Free Tier:** 50,000 map loads per month

---

### 2. Azure Storage (PRODUCTION)

**Purpose:** Persist routes and brigade data across devices

**How to obtain:**
- Follow the [Azure Setup Guide](./AZURE_SETUP.md)
- Or run: `./scripts/setup-azure-storage.sh`

**Secrets needed:**
- `AZURE_STORAGE_CONNECTION_STRING` - Full connection string
- `AZURE_STORAGE_ACCOUNT_NAME` - Account name only

**Free Tier:** 5GB storage, 20k transactions/month

---

### 3. Real-time Service (CHOOSE ONE)

#### Option A: Pusher (Easiest)

**Purpose:** WebSocket service for live tracking

**How to obtain:**
1. Sign up at [Pusher](https://dashboard.pusher.com/accounts/sign_up)
2. Create new app
3. Copy credentials from "App Keys" tab

**Secrets needed:**
- `PUSHER_APP_ID`
- `PUSHER_KEY` (public)
- `PUSHER_SECRET` (private)
- `PUSHER_CLUSTER` (e.g., "ap4" for Asia Pacific)

**Free Tier:** 200 connections, 200k messages/day

#### Option B: Firebase (Best Free Tier)

**Purpose:** Realtime Database for live tracking

**How to obtain:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project
3. Enable Realtime Database
4. Go to Project Settings > General
5. Copy Web API Key and other credentials

**Secrets needed:**
- `FIREBASE_API_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_APP_ID`

**Free Tier:** 50k simultaneous connections, 10GB/month downloads

#### Option C: Supabase (Open Source)

**Purpose:** Realtime service with PostgreSQL backend

**How to obtain:**
1. Sign up at [Supabase](https://supabase.com/dashboard)
2. Create new project
3. Go to Settings > API
4. Copy URL and anon key

**Secrets needed:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

**Free Tier:** Unlimited API requests, 2GB database

---

### 4. Deployment Tokens (OPTIONAL)

#### Vercel

**How to obtain:**
1. Go to [Vercel Account Settings](https://vercel.com/account/tokens)
2. Create new token
3. Name it "Fire Santa Run CI/CD"
4. Copy token

**Secrets needed:**
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID` (from project settings)
- `VERCEL_PROJECT_ID` (from project settings)

#### Netlify

**How to obtain:**
1. Go to [Netlify User Settings](https://app.netlify.com/user/applications)
2. Personal Access Tokens > New access token
3. Copy token

**Secrets needed:**
- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID` (from site settings)

---

## Local Development Setup

### Step 1: Create `.env.local`

```bash
# Copy the example file
cp .env.example .env.local
```

### Step 2: Fill in Your Secrets

Edit `.env.local`:

```bash
# Mapbox (Required for local dev)
VITE_MAPBOX_TOKEN=pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNsZXhhbXBsZSJ9.example

# Azure Storage (Optional for local dev - uses localStorage by default)
VITE_AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
VITE_AZURE_STORAGE_ACCOUNT_NAME=santarun

# Real-time Service (Optional for local dev)
# Choose ONE of the following:

# Pusher
VITE_PUSHER_KEY=your_key_here
VITE_PUSHER_CLUSTER=ap4

# OR Firebase
VITE_FIREBASE_API_KEY=your_key_here
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_APP_ID=your_app_id

# OR Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Step 3: Verify Setup

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Should see:
# ✓ Mapbox initialized
# ✓ Storage adapter loaded (localStorage or Azure)
```

### Important Notes

- `.env.local` is gitignored - NEVER commit this file
- `.env.example` is committed - NEVER add real secrets here
- Each developer maintains their own `.env.local`

---

## GitHub Actions Setup

### Step 1: Access Repository Secrets

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Navigate to **Secrets and variables** > **Actions**
4. Click **New repository secret**

### Step 2: Add Required Secrets

Add each secret individually:

#### Essential (Always Required)
```
Name: VITE_MAPBOX_TOKEN
Value: pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNsZXhhbXBsZSJ9.example
```

#### Production (For main branch deploys)
```
Name: AZURE_STORAGE_CONNECTION_STRING
Value: DefaultEndpointsProtocol=https;AccountName=...

Name: AZURE_STORAGE_ACCOUNT_NAME
Value: santarun

Name: PUSHER_KEY
Value: your_pusher_key

Name: PUSHER_CLUSTER
Value: ap4
```

#### Deployment (If using Vercel)
```
Name: VERCEL_TOKEN
Value: your_vercel_token

Name: VERCEL_ORG_ID
Value: team_xxx or user_xxx

Name: VERCEL_PROJECT_ID
Value: prj_xxx
```

### Step 3: Verify in Workflow

GitHub Actions will now have access to these secrets. Check workflow runs:
1. Go to **Actions** tab
2. Click on latest workflow run
3. Verify build step shows: "✓ Environment variables loaded"

---

## Deployment Setup

### Vercel Deployment

#### Via Dashboard (Recommended)
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Import your GitHub repository
3. Configure Project:
   - Framework Preset: **Vite**
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add Environment Variables:
   - Click **Environment Variables**
   - Add each secret (see list below)
   - Set environment: **Production**, **Preview**, **Development**
5. Deploy

#### Via CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Add environment variables
vercel env add VITE_MAPBOX_TOKEN
vercel env add VITE_AZURE_STORAGE_CONNECTION_STRING
# ... add all required variables
```

#### Environment Variables for Vercel
```
VITE_MAPBOX_TOKEN
VITE_AZURE_STORAGE_CONNECTION_STRING
VITE_AZURE_STORAGE_ACCOUNT_NAME
VITE_PUSHER_KEY
VITE_PUSHER_CLUSTER
VITE_APP_NAME
VITE_APP_URL
```

### Netlify Deployment

#### Via Dashboard
1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Click **Add new site** > **Import an existing project**
3. Connect to GitHub
4. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Go to **Site settings** > **Environment variables**
6. Add variables (same as Vercel list above)
7. Deploy

#### Via CLI
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize site
netlify init

# Add environment variables
netlify env:set VITE_MAPBOX_TOKEN "your_token"
# ... add all required variables

# Deploy
netlify deploy --prod
```

---

## Security Best Practices

### ✅ DO

- **Use environment variables** for all secrets
- **Use `.env.local`** for local development
- **Add `.env.local` to `.gitignore`**
- **Use different secrets** for development/staging/production
- **Rotate secrets** regularly (every 90 days)
- **Use minimal permissions** for service accounts
- **Enable 2FA** on all service accounts
- **Monitor usage** of API keys
- **Set up alerts** for unusual activity
- **Restrict tokens** to specific domains/IPs when possible

### ❌ DON'T

- **Never commit secrets** to git
- **Never hardcode secrets** in source code
- **Never share secrets** via email/chat
- **Never log secrets** to console
- **Never expose secrets** in error messages
- **Never use production secrets** in development
- **Never store secrets** in plaintext files
- **Never commit `.env.local`** file

### Secret Scanning

Add pre-commit hook to prevent secret commits:

```bash
# Install git-secrets
brew install git-secrets  # macOS
# or
apt-get install git-secrets  # Linux

# Set up in repo
git secrets --install
git secrets --register-aws
git secrets --add 'pk\.[a-zA-Z0-9]{40,}'  # Mapbox tokens
git secrets --add 'DefaultEndpointsProtocol=https'  # Azure
```

---

## Secret Rotation

### When to Rotate

- **Immediately** if compromised or exposed
- **Every 90 days** as routine maintenance
- **When team members leave** the project
- **After security incidents**
- **Before major releases**

### How to Rotate

#### Mapbox Token

1. Create new token in [Mapbox Dashboard](https://account.mapbox.com/access-tokens/)
2. Update secret in all environments:
   - `.env.local` (local)
   - GitHub Secrets
   - Vercel/Netlify environment variables
3. Deploy updated application
4. Verify new token works
5. Delete old token in Mapbox Dashboard

#### Azure Storage Key

```bash
# Regenerate key
az storage account keys renew \
  --resource-group rg-santa-run \
  --account-name santarun \
  --key primary

# Get new connection string
az storage account show-connection-string \
  --name santarun \
  --resource-group rg-santa-run \
  --query connectionString \
  --output tsv
```

Then update in all environments.

#### Pusher Credentials

1. Go to Pusher Dashboard
2. App Settings > App Credentials
3. Click "Reset" for App Secret
4. Update secret in all environments
5. Deploy

---

## Troubleshooting

### Issue: "Mapbox token not found"

**Symptom:** Map doesn't load, console shows error

**Solution:**
1. Verify `VITE_MAPBOX_TOKEN` is set
2. Check token starts with `pk.`
3. Verify token is valid in Mapbox Dashboard
4. Restart dev server: `npm run dev`

### Issue: "Azure connection failed"

**Symptom:** Data doesn't persist, 401/403 errors

**Solution:**
1. Verify connection string format
2. Check connection string includes `AccountKey`
3. Test connection: `npm run test:storage`
4. Verify tables exist in Azure Portal

### Issue: "Real-time not working"

**Symptom:** Live tracking doesn't update

**Solution:**
1. Check which service you're using (Pusher/Firebase/Supabase)
2. Verify all required credentials are set
3. Check browser console for WebSocket errors
4. Verify firewall doesn't block WebSocket connections

### Issue: "Environment variables not loading"

**Symptom:** App shows default values

**Solution:**
1. Verify file is named `.env.local` (not `.env`)
2. Restart dev server
3. Check variables start with `VITE_`
4. Verify no syntax errors in `.env.local`

### Issue: "Build fails in CI"

**Symptom:** GitHub Actions fails on build step

**Solution:**
1. Check GitHub Secrets are set
2. Verify secret names match exactly
3. Check workflow file uses correct secret names
4. Review GitHub Actions logs for specific error

---

## Validation Checklist

Before deploying:

- [ ] All required secrets configured locally
- [ ] App runs successfully with `npm run dev`
- [ ] Map loads correctly
- [ ] Data persists correctly
- [ ] All GitHub Secrets configured
- [ ] CI/CD pipeline passes
- [ ] Deployment environment variables set
- [ ] Preview deployment works
- [ ] Production deployment successful
- [ ] No secrets in git history
- [ ] `.env.local` in `.gitignore`
- [ ] Secret rotation schedule documented

---

## Quick Reference

### All Required Secrets

```bash
# Essential
VITE_MAPBOX_TOKEN=pk.xxx

# Storage (Production)
VITE_AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https...
VITE_AZURE_STORAGE_ACCOUNT_NAME=santarun

# Real-time (Choose ONE)
VITE_PUSHER_KEY=xxx
VITE_PUSHER_CLUSTER=ap4
# OR
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_APP_ID=xxx
# OR
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx

# Deployment (Optional)
VERCEL_TOKEN=xxx
VERCEL_ORG_ID=xxx
VERCEL_PROJECT_ID=xxx
# OR
NETLIFY_AUTH_TOKEN=xxx
NETLIFY_SITE_ID=xxx
```

### Links

- [Mapbox Dashboard](https://account.mapbox.com/)
- [Azure Portal](https://portal.azure.com/)
- [Pusher Dashboard](https://dashboard.pusher.com/)
- [Firebase Console](https://console.firebase.google.com/)
- [Supabase Dashboard](https://supabase.com/dashboard)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Netlify Dashboard](https://app.netlify.com/)
- [GitHub Secrets](https://github.com/settings/secrets/actions)

---

## Support

If you encounter issues not covered here:
1. Check the [troubleshooting section](#troubleshooting)
2. Review service status pages
3. Check GitHub Actions logs
4. Consult service documentation
5. Open an issue in the repository
