# PersonalityOS — Complete Setup Guide

**Audience:** Solo founder, first-time setup
**Goal:** Get the full workflow running: Claude Code → Git → GitHub → Cloudflare
**Last Updated:** June 2026

---

## What You Are Setting Up

By the end of this guide, the following will be true:

1. Your code lives on your computer and on GitHub
2. When you merge code to `develop`, Cloudflare automatically deploys a preview
3. When you merge code to `main`, Cloudflare automatically deploys to production
4. Direct pushes to `main` are blocked — you can never accidentally overwrite production
5. Claude Code has operating rules and context for every session

This guide is the **first thing you do before writing a single line of application code.**

---

## Prerequisites

Before starting, you need:
- [ ] A computer (Mac or Windows)
- [ ] Internet connection
- [ ] An email address (for account signups)
- [ ] A credit card (for API account signups — most are free tier, card needed for verification)

Time estimate: 2-3 hours for complete first-time setup.

---

# PHASE 1: Create All Accounts

Do this in one sitting. Have a password manager open (1Password, Bitwarden, or even a notes app that is secure). Save every username, password, and API key immediately.

---

## Account 1: GitHub

**What GitHub is:** The cloud backup for your code. Every file you write gets stored here. It also triggers your deployments.

1. Go to github.com
2. Click "Sign up"
3. Enter your email address
4. Create a strong password (save it)
5. Choose a username — this will appear in your URLs, so choose something professional: `yourname` or `yourname-dev`
6. Verify your email (check inbox)
7. On the "Welcome to GitHub" page → click "Skip personalization"
8. You are now on the GitHub dashboard

**Save:** Username + password

---

## Account 2: Cloudflare

**What Cloudflare is:** The hosting platform for your app. It runs your frontend (website) and your backend (API). Free tier covers everything you need.

1. Go to cloudflare.com
2. Click "Sign Up" (top right)
3. Enter email + create password (save it)
4. Verify your email
5. On the welcome screen → click "Add a site" if prompted, but skip it for now (we don't have a domain yet)
6. You are on the Cloudflare dashboard

**Save:** Email + password

---

## Account 3: Supabase

**What Supabase is:** Your database. It stores all character and generation data. It also handles user login.

1. Go to supabase.com
2. Click "Start your project"
3. Sign in with GitHub (click "Continue with GitHub" → authorise Supabase)
4. You are now on the Supabase dashboard
5. Click "New project"
6. Organization: your personal organization (auto-created)
7. Project name: `personalityos`
8. Database password: create a strong password (save this — you cannot recover it)
9. Region: `Southeast Asia (Singapore)` — closest to India
10. Click "Create new project" (takes 1-2 minutes)

**After project is created:**
11. Go to Settings (gear icon, bottom left) → API
12. Copy and save:
    - `Project URL` → save as `SUPABASE_URL`
    - `Project API keys → anon public` → save as `SUPABASE_ANON_KEY`
    - `Project API keys → service_role` → save as `SUPABASE_SERVICE_KEY`

**⚠️ WARNING: The service_role key is a master key.** Never put it in your frontend code. Never commit it to GitHub. It bypasses all security. Save it only in your password manager and your `.dev.vars` file.

**Save:** Project URL + anon key + service_role key + database password

---

## Account 4: Anthropic (Claude API)

**What this is:** The API that lets your app call Claude for content generation.

1. Go to console.anthropic.com
2. Sign up with email
3. Verify email
4. Go to "API Keys" in the left sidebar
5. Click "Create Key"
6. Name it: `personalityos-v1`
7. Copy the key immediately (shown only once)
8. Save it as `ANTHROPIC_API_KEY`
9. Add credits: go to "Billing" → add ₹500 worth (roughly $6 USD)

**Save:** API key

---

## Account 5: OpenRouter

**What this is:** A gateway to Qwen3 32B and other open-source models. Free tier for the models you need.

1. Go to openrouter.ai
2. Click "Sign In" → sign in with Google or GitHub
3. Go to "Keys" in the top navigation
4. Click "Create Key"
5. Name it: `personalityos`
6. Copy the key
7. Save it as `OPENROUTER_API_KEY`
8. Add credits: go to "Credits" → add ₹500

**Save:** API key

---

## Account 6: MuAPI

**What this is:** The image generation service. Powers Flux, Midjourney, and 200+ models.

1. Go to muapi.ai
2. Sign up with email
3. Verify email
4. Go to API Keys (in your account settings)
5. Create a new API key
6. Copy and save as `MUAPI_API_KEY`
7. Add credits: ₹1,000 (covers ~400 image generations)

**Save:** API key

---

## Account 7: PostHog

**What this is:** User analytics. Tells you how users are using your product.

1. Go to posthog.com
2. Click "Get started free"
3. Sign up with email
4. Choose: "I'll use PostHog Cloud"
5. Region: US (fine for V1)
6. After setup, go to Settings → Project → Project API Key
7. Copy and save as `POSTHOG_API_KEY`

**Save:** API key

---

## Account Checklist

Before moving to Phase 2, confirm you have saved all of these:

```
GitHub:     [ ] username  [ ] password
Cloudflare: [ ] email     [ ] password
Supabase:   [ ] SUPABASE_URL  [ ] SUPABASE_ANON_KEY  [ ] SUPABASE_SERVICE_KEY
Anthropic:  [ ] ANTHROPIC_API_KEY
OpenRouter: [ ] OPENROUTER_API_KEY
MuAPI:      [ ] MUAPI_API_KEY
PostHog:    [ ] POSTHOG_API_KEY
```

If any is missing, go back and get it now. You will need every single one.

---

# PHASE 2: Set Up Your Computer

---

## Step 1: Install Node.js

**What Node.js is:** The software that runs JavaScript on your computer. Required for everything else.

**On Mac:**
1. Go to nodejs.org
2. Click the big green button: "LTS Recommended For Most Users"
3. Download the `.pkg` file
4. Double-click to install → follow the prompts
5. Open Terminal (Command + Space → type "Terminal" → Enter)
6. Type: `node --version`
7. You should see something like: `v20.11.0`
8. Type: `npm --version`
9. You should see something like: `10.2.4`

**On Windows:**
1. Go to nodejs.org
2. Download the Windows Installer (.msi)
3. Run the installer → follow the prompts, accept all defaults
4. Open Command Prompt (Windows key + R → type "cmd" → Enter)
5. Type: `node --version`
6. Type: `npm --version`

If both commands show version numbers, Node.js is installed.

---

## Step 2: Install VS Code

**What VS Code is:** A text editor designed for writing code. This is where you will read the code Claude writes.

1. Go to code.visualstudio.com
2. Download for your operating system
3. Install it (drag to Applications on Mac, run installer on Windows)
4. Open VS Code
5. Install these extensions (click the blocks icon on the left sidebar → search for each):
   - "ESLint" by Microsoft
   - "Tailwind CSS IntelliSense" by Tailwind Labs
   - "GitLens" by GitKraken
   - "Prettier - Code formatter" by Prettier
   - "TypeScript Hero" or just "TypeScript" (usually pre-installed)

---

## Step 3: Install Claude Code

**What Claude Code is:** The AI assistant that runs in your terminal and writes code.

In your terminal:

```bash
npm install -g @anthropic-ai/claude-code
```

**What `-g` means:** Install "globally" — meaning it is available from any folder, not just one project.

After installation:

```bash
claude
```

Claude Code will ask you to authenticate with your Anthropic account. Follow the prompts. Once done, type "exit" to close the session.

---

## Step 4: Install Wrangler

**What Wrangler is:** The command-line tool for Cloudflare Workers. You use it to deploy your backend.

```bash
npm install -g wrangler
```

After installation:

```bash
wrangler login
```

This opens a browser window. Click "Allow" to authorise Wrangler to access your Cloudflare account.

Test it:

```bash
wrangler whoami
```

You should see your Cloudflare account name and email.

---

## Step 5: Install Git

**On Mac:** Git is usually pre-installed. Check:
```bash
git --version
```
If it shows a version number, you are done. If not:
- Install from git-scm.com
- Or run `xcode-select --install` in Terminal

**On Windows:**
1. Go to git-scm.com
2. Download the Windows installer
3. Install with defaults (accept everything)
4. Open "Git Bash" (installed with Git) — use this instead of Command Prompt for git commands

Configure git with your name and email (do this once):

```bash
git config --global user.name "Your Full Name"
git config --global user.email "your@email.com"
```

---

# PHASE 3: Create the GitHub Repository

---

## Step 1: Create Repository on GitHub

1. Go to github.com → click the "+" icon (top right) → "New repository"
2. Repository name: `personalityos` (all lowercase)
3. Description: "Digital Identity OS for AI content creators"
4. Visibility: **Private** (keep your code private)
5. Do NOT check "Add a README file"
6. Do NOT add .gitignore (we will create our own)
7. Do NOT choose a license
8. Click "Create repository"

GitHub shows a page with setup instructions. Keep this page open — you will need the repository URL in a moment.

---

## Step 2: Create the Project on Your Computer

In your terminal:

```bash
# Navigate to where you want to create the project
cd ~/Documents
mkdir Projects
cd Projects

# Create the Next.js project
npx create-next-app@latest personalityos --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

This runs an interactive installer. Answer:

```
Would you like to use ESLint? → Yes
Would you like to use src/ directory? → No
Would you like to use App Router? → Yes
Would you like to customize the default import alias? → No
```

Wait for it to complete (1-2 minutes).

```bash
cd personalityos
```

---

## Step 3: Connect Project to GitHub

```bash
# Initialise git in the project folder
git init

# Add GitHub as the remote destination
git remote add origin https://github.com/YOURUSERNAME/personalityos.git
# Replace YOURUSERNAME with your actual GitHub username

# Create the main branch
git checkout -b main
```

---

## Step 4: Create the .gitignore File

**What .gitignore is:** A list of files that git should never track. This protects your secrets.

In VS Code, open the project: `code .` (in terminal, inside the personalityos folder)

Look for the file `.gitignore` in the file tree on the left. Click it to open. Add these lines to the TOP of the file:

```
# Secrets — NEVER COMMIT THESE
.env
.env.local
.env.*.local
.dev.vars

# Build outputs
.next/
.wrangler/
dist/
build/

# Dependencies
node_modules/

# System files
.DS_Store
Thumbs.db
```

Save the file (Command+S on Mac, Ctrl+S on Windows).

---

## Step 5: Create the Required Folders

In your terminal (make sure you are inside the `personalityos` folder):

```bash
# Create all required directories
mkdir -p docs agents workers/api/src .claude

# Verify the structure
ls
# You should see: app/ components/ docs/ agents/ workers/ .claude/ public/ and config files
```

---

## Step 6: Create the Project Documents

Now copy the seven documents you have been given into the `docs/` and `.claude/` folders:

```bash
# The documents should be placed at these paths:
docs/DEVELOPMENT_WORKFLOW.md
docs/GITHUB_STRATEGY.md
docs/CLOUDFLARE_DEPLOYMENT.md
docs/GITHUB_ACTIONS_PLAN.md
docs/CLAUDE_ENGINEERING_GUIDE.md
docs/AUTOMATION_ROADMAP.md
.claude/project.md
```

Also copy your existing architecture documents:

```bash
docs/PRODUCT_VISION.md
docs/MVP_SCOPE.md
docs/DATABASE_SCHEMA.md
docs/SYSTEM_ARCHITECTURE.md
docs/14_DAY_EXECUTION_PLAN.md
docs/BEGINNER_GUIDE.md
docs/README_ANALYSIS.md
```

And the agent files:

```bash
agents/00_AGENT_SYSTEM_OVERVIEW.md
agents/01_CTO_AGENT.md
agents/02_FRONTEND_AGENT.md
agents/03_BACKEND_AGENT.md
agents/04_PROMPT_DNA_AGENT.md
agents/05_QUALITY_AGENT.md
agents/06_GROWTH_AGENT.md
agents/07_VIDEO_AGENT.md
agents/08_VOICE_AGENT.md
agents/09_MARKETPLACE_AGENT.md
```

---

## Step 7: Create the Environment Files

Create `.env.local` in the project root:

```bash
# In VS Code, right-click in the file tree → New File → .env.local
```

Contents:

```
NEXT_PUBLIC_SUPABASE_URL=paste-your-supabase-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=paste-your-anon-key-here
NEXT_PUBLIC_WORKER_URL=http://localhost:8787
NEXT_PUBLIC_POSTHOG_KEY=paste-your-posthog-key-here
```

Create `workers/api/.dev.vars`:

```bash
# In VS Code, navigate to workers/api/ → New File → .dev.vars
```

Contents:

```
SUPABASE_URL=paste-your-supabase-url-here
SUPABASE_ANON_KEY=paste-your-anon-key-here
SUPABASE_SERVICE_KEY=paste-your-service-role-key-here
ANTHROPIC_API_KEY=paste-your-anthropic-key-here
OPENROUTER_API_KEY=paste-your-openrouter-key-here
MUAPI_API_KEY=paste-your-muapi-key-here
POSTHOG_API_KEY=paste-your-posthog-key-here
LLM_PROVIDER=openrouter
```

**Verify .gitignore is working:**

```bash
git status
```

You should NOT see `.env.local` or `.dev.vars` in the output. If you do see them — stop. Your .gitignore is not working. Fix it before doing anything else.

---

## Step 8: First Commit and Push

```bash
# Stage everything
git add .

# Check what is staged (look carefully — no .env files should appear)
git status

# Commit
git commit -m "Initial project setup with workflow documentation"

# Set the upstream and push to GitHub
git push -u origin main
```

Go to github.com → your repository. You should see your files. Verify that `.env.local` and `.dev.vars` are NOT visible — if they are, your secrets are exposed and you need to immediately rotate all your API keys.

---

## Step 9: Create the develop Branch

```bash
git checkout -b develop
git push -u origin develop
```

Now you have two branches: `main` and `develop`.

---

# PHASE 4: Configure GitHub Branch Protection

---

## Step 1: Protect the main Branch

1. github.com → your repository → Settings → Branches
2. Click "Add branch protection rule"
3. Branch name pattern: `main`
4. Check these options:
   - ✅ Require a pull request before merging
   - ✅ Require approvals: 1
   - ✅ Block force pushes
   - ✅ Restrict who can push to matching branches
5. Click "Create"

---

## Step 2: Protect the develop Branch

1. Click "Add branch protection rule" again
2. Branch name pattern: `develop`
3. Check:
   - ✅ Require a pull request before merging
   - ✅ Block force pushes
4. Click "Create"

---

# PHASE 5: Connect Cloudflare Pages

---

## Step 1: Connect GitHub Repository

1. Go to dash.cloudflare.com
2. Left sidebar → Workers & Pages → Pages
3. Click "Create a project"
4. Click "Connect to Git"
5. Connect GitHub → Authorize
6. Select repository: `personalityos`
7. Click "Begin setup"

---

## Step 2: Build Configuration

```
Project name: personalityos
Production branch: main
Framework preset: Next.js
Build command: npm run build
Build output directory: .next
```

Click "Save and Deploy".

Wait for the first build (2-3 minutes). It may fail on this first deploy because environment variables are not set yet. That is fine.

---

## Step 3: Add Environment Variables

1. Pages project → Settings → Environment variables
2. Add for "Production" environment:

```
NEXT_PUBLIC_SUPABASE_URL        = your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY  = your-anon-key
NEXT_PUBLIC_WORKER_URL          = (fill in after deploying Worker)
NEXT_PUBLIC_POSTHOG_KEY         = your-posthog-key
NODE_VERSION                    = 18
```

3. Click "Save"

---

## Step 4: Enable Preview Deployments

1. Pages project → Settings → Builds & deployments
2. Preview deployments → "Configure preview deployments"
3. Select: "All non-production branches"
4. Save

Now every push to `develop` gets a preview URL.

---

## Step 5: Enable Failure Notifications

1. Cloudflare dashboard → Notifications (bell icon, top right)
2. "Add Notification" → "Pages — Project deploy failed"
3. Enter your email
4. Save

---

# PHASE 6: Verify the Workflow

Do this end-to-end test to confirm everything is connected.

---

## The Test

```bash
# 1. Create a test feature branch
git checkout develop
git pull origin develop
git checkout -b feature/workflow-test

# 2. Make a trivial change
# Open app/page.tsx in VS Code
# Change any text on the page
# Save the file

# 3. Commit the change
git add .
git commit -m "test: verify workflow end-to-end"

# 4. Push the branch
git push -u origin feature/workflow-test
```

5. Go to github.com → your repository
6. GitHub shows: "feature/workflow-test had recent pushes — Compare & pull request"
7. Click "Compare & pull request"
8. Title: "Test: workflow verification"
9. Click "Create pull request"
10. Go to "Files changed" tab — you should see your text change
11. Click "Merge pull request" → "Confirm merge"

12. Go to dash.cloudflare.com → Pages → personalityos → Deployments
13. You should see a new deployment triggered for `develop` branch
14. Wait 2-3 minutes
15. Click the deployment URL — your app appears

**If you see the app at the Cloudflare URL:** Your workflow is fully connected. ✅

**If the deployment failed:** Go to the deployment → "View build log" → read the error message → ask Claude Code to explain and fix.

---

## Clean Up the Test

```bash
git checkout develop
git pull origin develop
# The feature/workflow-test branch was merged and can be deleted on GitHub
```

On GitHub: Branches → find feature/workflow-test → click the trash icon to delete it.

---

# PHASE 7: Set Up Claude Code for the Project

---

## Step 1: Test Claude Code in the Project

```bash
cd ~/Documents/Projects/personalityos
claude
```

Use this opening prompt:

```
Read .claude/project.md
Read docs/DEVELOPMENT_WORKFLOW.md
Read docs/CLAUDE_ENGINEERING_GUIDE.md

Confirm you have read all three documents.
Tell me:
1. What phase is PersonalityOS in?
2. What are the two things Claude Code is forbidden from doing to the git repository?
3. What is the first thing you do at the start of every session?
```

Claude Code should answer accurately from the documents. If it cannot, the documents were not placed in the right location.

---

## Step 2: Create the BACKLOG File

```bash
# Create an empty backlog file
echo "# PersonalityOS — Backlog\n\nFuture features and ideas, not in current scope.\n\n## V2 Ideas\n\n## V3 Ideas\n\n## V4 Ideas\n" > docs/BACKLOG.md

git add docs/BACKLOG.md
git commit -m "docs: add empty backlog file"
git push
```

Create PR → merge to develop → Cloudflare deploys.

---

# Setup Complete

You now have:

```
✅ All accounts created and API keys saved
✅ Node.js, VS Code, Claude Code, Wrangler, Git installed
✅ GitHub repository: personalityos (private)
✅ Two branches: main (production) and develop (preview)
✅ Branch protection: direct pushes to main/develop blocked
✅ Cloudflare Pages: connected to GitHub, auto-deploy on push
✅ Environment variables set in Cloudflare
✅ Workflow documentation in docs/ folder
✅ Claude operating manual in .claude/project.md
✅ Claude Code tested and reading project documents
```

Your first working session starts tomorrow.
Open terminal → `cd ~/Documents/Projects/personalityos` → `git checkout -b feature/day-1-foundation` → `claude`

Use the daily context prompt from `docs/DEVELOPMENT_WORKFLOW.md`.

---

## Emergency Reference

**Undo last commit (keep code):**
```bash
git reset --soft HEAD~1
```

**Throw away all uncommitted changes:**
```bash
git restore .
```

**Roll back Cloudflare deployment:**
Cloudflare → Pages → Deployments → find last working → ⋯ → Rollback

**Check if Worker is running:**
```bash
curl https://personalityos-api.YOURNAME.workers.dev/health
```

**Stream Worker logs (for debugging):**
```bash
wrangler tail personalityos-api
```
