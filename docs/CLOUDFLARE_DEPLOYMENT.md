# PersonalityOS — Cloudflare Deployment Guide

**Audience:** Solo founder setting up for the first time
**Last Updated:** June 2026

---

## The Complete Deployment Picture

```
You write code
      ↓
Claude Code helps build it (feature branch)
      ↓
You commit and push to GitHub
      ↓
You merge PR to develop
      ↓
Cloudflare Pages AUTOMATICALLY builds and deploys
      ↓
Preview URL is live for your testing
      ↓
When ready: merge develop → main
      ↓
Cloudflare Pages AUTOMATICALLY deploys to production
      ↓
Real users see the update
```

The key insight: **you never run a deploy command.** GitHub + Cloudflare do it automatically. Your job is code review, not deployment.

---

## What Gets Deployed Where

| Branch | Auto-Deploy? | URL | Who Sees It |
|---|---|---|---|
| `feature/*` | No | None | Only your localhost |
| `develop` | Yes | `develop.personalityos.pages.dev` | Only you (testing) |
| `main` | Yes | `personalityos.pages.dev` | Real users |

Two separate deployments. Two separate URLs. The develop URL is your preview environment — break things there freely. Main is production.

---

## Part 1: One-Time Setup

### Step 1: Create Your Cloudflare Account

1. Go to cloudflare.com
2. Click "Sign Up"
3. Email + password → verify email
4. You are on the Cloudflare dashboard

Cost: Free. Cloudflare Pages free tier covers everything in V1.

---

### Step 2: Connect GitHub to Cloudflare Pages

**What this does:** Cloudflare watches your GitHub repository. When you push to develop or main, Cloudflare automatically pulls the code, builds it, and deploys it.

1. In Cloudflare dashboard → left sidebar → "Workers & Pages"
2. Click "Pages"
3. Click "Create a project"
4. Click "Connect to Git"
5. Click "Connect GitHub"
6. A GitHub authorization popup appears → click "Authorize Cloudflare Pages"
7. Select the repository: `personalityos`
8. Click "Begin setup"

---

### Step 3: Configure the Build Settings

On the "Set up builds and deployments" screen:

```
Project name: personalityos

Production branch: main

Framework preset: Next.js

Build command: npm run build

Build output directory: .next

Root directory: /
(leave blank — your Next.js app is at the root)
```

Click "Save and Deploy" — this triggers the first deployment.

---

### Step 4: Set Up the Preview Branch (develop)

After the project is created:

1. Go to your Pages project → "Settings" → "Builds & deployments"
2. Under "Preview deployments" → "Configure preview deployments"
3. Set to "All non-production branches"
4. This means `develop` (and any feature branch you push) gets a preview URL

---

### Step 5: Add Environment Variables

**What environment variables are:** Configuration values your application needs to run, but that should never be stored in your code (because they contain API keys and secrets).

In Cloudflare Pages → your project → "Settings" → "Environment variables"

**Production environment (for main branch):**

| Variable Name | Value | Where to Get It |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJh...` (long string) | Supabase → Settings → API |
| `NEXT_PUBLIC_WORKER_URL` | `https://personalityos-api.yourname.workers.dev` | After deploying the Worker |
| `NEXT_PUBLIC_POSTHOG_KEY` | `phc_...` | PostHog → Project Settings |

**Preview environment (for develop branch):**

Use the same values as production for V1. When you have separate staging infrastructure, you would use different values here.

Click "Add variable" for each one. Click "Save".

---

### Step 6: Deploy the Cloudflare Worker (Backend)

Your frontend (Next.js) is on Cloudflare Pages. Your backend (Hono API) runs on Cloudflare Workers. These are separate deployments.

**What a Cloudflare Worker is:** A small server that runs at the edge (near your users, not in one data centre). It handles your API routes: `/api/characters`, `/api/chat`, `/api/generate`, etc.

```bash
# In your terminal, navigate to the workers directory
cd ~/Documents/Projects/personalityos/workers/api

# Deploy the Worker
wrangler deploy

# You will see output like:
# Deployed personalityos-api (1.2 sec)
# https://personalityos-api.yourname.workers.dev
```

**Set Worker secrets** (these are environment variables for the backend — they contain sensitive keys):

```bash
# Run each command and paste the value when prompted
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SUPABASE_SERVICE_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put OPENROUTER_API_KEY
wrangler secret put MUAPI_API_KEY
wrangler secret put POSTHOG_API_KEY
wrangler secret put LLM_PROVIDER
```

**What "wrangler secret put" does:** Encrypts your API key and stores it securely in Cloudflare's system. The key is never visible in your code or GitHub. When your Worker runs, Cloudflare injects it automatically.

---

### Step 7: Configure Supabase Auth URLs

After your Pages project is live, Supabase needs to know your URLs to allow authentication:

1. Go to supabase.com → your project → Authentication → URL Configuration
2. Site URL: `https://personalityos.pages.dev`
3. Redirect URLs (add all of these):
   ```
   https://personalityos.pages.dev/auth/callback
   https://develop.personalityos.pages.dev/auth/callback
   http://localhost:3000/auth/callback
   ```
4. Click Save

**Why this matters:** When a user clicks a login link in their email, Supabase needs to know which URLs are allowed to receive the authentication callback. If your URL is not on this list, login will fail.

---

### Step 8: Configure CORS in Your Worker

Your Worker needs to allow requests from your Pages URLs. Update `workers/api/src/index.ts`:

```typescript
// The allowed origins
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://personalityos.pages.dev',
  'https://develop.personalityos-abc123.pages.dev'  // your actual develop URL
];
```

Ask Claude Code to make this change once you have your Pages URLs.

---

### Step 9: Create the R2 Storage Bucket (Production)

```bash
# Create the production storage bucket
wrangler r2 bucket create personalityos-storage

# Verify it was created
wrangler r2 bucket list
```

---

## Part 2: How Deployments Work Day-to-Day

### When You Push to develop

1. You run `git push` on a feature branch
2. You create a PR on GitHub and merge to develop
3. Within 60 seconds, Cloudflare detects the push
4. Cloudflare pulls your code and runs `npm run build`
5. If the build succeeds: your preview URL updates
6. If the build fails: you get an email from Cloudflare, production is untouched

**How to check deployment status:**
- Go to Cloudflare dashboard → Pages → personalityos → "Deployments" tab
- Each deployment shows: commit hash, branch, status (Success / Failed), timestamp
- Click any deployment to see the build logs (useful for debugging)

---

### When You Push to main

Everything above happens, except the result goes to your production URL (`personalityos.pages.dev`). Real users see the update within 1-2 minutes.

**This is why main is protected.** Every push to main is a live deployment.

---

### How Long Does a Deploy Take?

| Stage | Time |
|---|---|
| Cloudflare detects push | ~10 seconds |
| Next.js build (`npm run build`) | ~45-90 seconds |
| Global distribution | ~30 seconds |
| **Total: user sees update** | **~2 minutes** |

---

## Part 3: Build Commands Reference

### Next.js Frontend (Cloudflare Pages)

```
Build command:   npm run build
Output dir:      .next
Node version:    18 (set in Environment Variables: NODE_VERSION = 18)
```

### Cloudflare Worker (Manual Deploy)

```bash
# Deploy latest Worker code
cd workers/api
wrangler deploy

# Deploy to a specific environment
wrangler deploy --env staging

# Preview Worker locally
wrangler dev
```

**Important difference:** Your Next.js frontend deploys automatically when you push to GitHub. Your Cloudflare Worker deploys manually using `wrangler deploy`. You run this command from your terminal after making Worker changes.

---

## Part 4: Environment Variables Complete Reference

### Frontend (Cloudflare Pages)

These variables start with `NEXT_PUBLIC_` because they are visible to the browser. Never put secret API keys in NEXT_PUBLIC_ variables.

| Variable | Description | Safe to expose? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Yes — it's a public URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (limited permissions) | Yes — designed to be public |
| `NEXT_PUBLIC_WORKER_URL` | Your Worker URL | Yes — it's a public URL |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog tracking key | Yes — designed to be public |

### Worker (Cloudflare Worker Secrets)

These are stored encrypted in Cloudflare and injected at runtime. Never appear in code or GitHub.

| Variable | Description | Ever expose? |
|---|---|---|
| `SUPABASE_URL` | Same as above but for Worker | Never |
| `SUPABASE_ANON_KEY` | Supabase anon key | Never |
| `SUPABASE_SERVICE_KEY` | Admin key — bypasses row-level security | NEVER |
| `ANTHROPIC_API_KEY` | Claude API key | Never |
| `OPENROUTER_API_KEY` | OpenRouter (Qwen) API key | Never |
| `MUAPI_API_KEY` | MuAPI image generation key | Never |
| `POSTHOG_API_KEY` | Server-side PostHog | Never |
| `LLM_PROVIDER` | "openrouter" or "anthropic" | Never |

---

## Part 5: Rollback Strategy

### What "rollback" means
If you deploy something broken to production, rollback means restoring the previous working version. On Cloudflare Pages this takes about 30 seconds.

### How to Roll Back (Frontend)

1. Go to Cloudflare dashboard → Pages → personalityos → "Deployments"
2. Find the last deployment marked "Success" before the broken one
3. Click the three-dot menu (⋯) next to it
4. Click "Rollback to this deployment"
5. Cloudflare instantly serves the old version
6. Production is restored

**What this does NOT do:** It does not change your GitHub code. Your git history still shows the broken commit. You need to revert it separately (instructions below).

---

### How to Revert the Broken Code in GitHub

After rolling back Cloudflare, fix the code:

```bash
git checkout main

# See the commit history
git log --oneline

# Find the commit hash before the bad one (copy the 7-character hash)
# Example: a3f9c12

# Revert the bad commit (creates a new commit that undoes it)
git revert HEAD
# Or revert a specific commit:
git revert [commit-hash]

git push
# This triggers a new Cloudflare deployment — now with the bad commit reverted
```

**Why `git revert` instead of `git reset`?**
`git revert` creates a new commit that undoes the bad one. `git reset` rewrites history, which can cause problems on shared branches. Always use `revert` on main and develop.

---

### How to Roll Back the Worker

```bash
# List previous Worker deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback

# Rollback to a specific version
wrangler rollback [deployment-id]
```

---

## Part 6: Monitoring and Alerts

### Cloudflare Pages Build Alerts

Enable email notifications for failed deployments:
1. Cloudflare dashboard → Notifications (bell icon)
2. Add notification → "Pages — Project deploy failed"
3. Enter your email
4. Save

Now you get an email any time a deployment fails. You will know within minutes.

---

### Checking if Your App is Running

```bash
# Test the Worker health endpoint
curl https://personalityos-api.yourname.workers.dev/health
# Expected: {"status":"ok"}

# Test production frontend
# Just open the URL in an incognito browser window
```

---

### Cloudflare Worker Logs (For Debugging)

```bash
# Stream live logs from the deployed Worker
wrangler tail personalityos-api

# Every request to your Worker will appear here in real time
# Useful for debugging production issues
```

---

## Part 7: Custom Domain (Optional, After V1)

Once you have real users, you may want `www.personalityos.com` instead of `personalityos.pages.dev`.

1. Buy a domain (Cloudflare Registrar → cheapest and no transfer fees)
2. Cloudflare Pages → your project → "Custom domains"
3. Add your domain
4. Cloudflare auto-configures DNS
5. HTTPS certificate is provisioned automatically (free)

This is a future step. `pages.dev` domains work fine for V1.

---

## Quick Reference: Deployment Checklist

**Before merging develop → main (production deploy):**
```
[ ] End-to-end test in incognito window
[ ] Signup → character creation → image generation → library all work
[ ] No API keys in source code
[ ] Error states show friendly messages
[ ] Mobile layout tested
[ ] Quality Agent checklist completed
[ ] Cloudflare preview URL tested
```

**After merging to main:**
```
[ ] Watch Cloudflare deployment status (should complete in ~2 minutes)
[ ] Open production URL in incognito
[ ] Run the key flows once more on production
[ ] Check Cloudflare Pages → Deployments → latest shows "Success"
```
