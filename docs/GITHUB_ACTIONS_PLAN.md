# PersonalityOS — GitHub Actions Plan

**Status:** PLAN ONLY — Do not implement until V1 is deployed and stable
**Audience:** Solo founder + future Claude Code session that will implement this
**Last Updated:** June 2026

---

## What Is GitHub Actions?

GitHub Actions is an automation system built into GitHub. You write a YAML file (a configuration file) that says: "When X happens, run Y steps."

For PersonalityOS, GitHub Actions will eventually:
- Check that your code compiles correctly before merging
- Check for obvious quality issues (formatting, type errors)
- Prevent broken code from reaching your users
- Create deployment records automatically

**Why this is a PLAN and not implementation yet:**
You are a solo founder in active V1 development. GitHub Actions adds complexity. Adding it before your code is stable means you will spend time debugging the CI pipeline instead of building the product. Implement Level 1 Actions after V1 is deployed to real users.

---

## Three Automation Levels

This plan is designed in three levels. Each level builds on the previous one.

```
Level 1 (implement after V1 deploys)
  → Basic safety: lint + type check on every PR
  → Prevents typos and obvious errors from reaching develop

Level 2 (implement after first 10 paying users)
  → Full build validation + automated security scan
  → Claude Code can draft release notes

Level 3 (implement after V1.5 is stable)
  → Automated test suite
  → Performance monitoring
  → Automatic previews per branch
```

---

## Level 1 Actions (Implement After V1)

### Action A: PR Validation

**Trigger:** Every pull request created or updated targeting `develop` or `main`

**What it does:**
1. Checks out the code
2. Installs Node.js dependencies
3. Runs TypeScript type check
4. Runs ESLint (code style checker)
5. Runs the production build
6. Reports pass or fail in the PR

**Why this matters:** It catches errors that you and Claude might miss. If TypeScript finds a type error that would crash the app at runtime, the check fails and GitHub blocks the merge until it is fixed.

**File location when implemented:** `.github/workflows/pr-validation.yml`

**Inputs required (to prepare now):**
- ESLint config: `.eslintrc.json` in project root (Claude Code can create this on Day 1)
- TypeScript config: `tsconfig.json` (created by Next.js setup)
- Build script: `npm run build` (created by Next.js setup)

**Approximate workflow steps:**

```yaml
# PLAN — not final YAML, for reference only
name: PR Validation
on: pull_request (targeting develop, main)
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - Checkout code
      - Setup Node.js 18
      - Cache node_modules (speed up future runs)
      - Run: npm ci
      - Run: npm run type-check  (tsc --noEmit)
      - Run: npm run lint        (eslint)
      - Run: npm run build
      - Report results
```

**Expected run time:** 2-3 minutes per PR

**Cost:** Free (GitHub Actions free tier: 2,000 minutes/month)

---

### Action B: Branch Protection Enforcement

**Trigger:** Any push attempt to `main` or `develop`

**What it does:**
- Blocks direct pushes to `main` (must go through PR)
- Blocks direct pushes to `develop` (must go through PR)

**How to implement:** This is a GitHub Settings rule, not an Actions workflow. Set it in: repository Settings → Branches → Branch protection rules.

**Steps:**
1. github.com → your repository → Settings → Branches
2. Add rule for `main`:
   - Require pull request before merging (1 approval required)
   - Require status checks to pass (add the PR Validation check)
   - Block force pushes
   - Block deletions
3. Add rule for `develop`:
   - Require pull request before merging
   - Block force pushes

**Result:** GitHub will refuse any push directly to main or develop. Even you cannot bypass it from the terminal. The only way to get code onto these branches is through a reviewed PR.

---

### Action C: Dependency Security Check

**Trigger:** Every push to `develop`

**What it does:** Runs `npm audit` to check your dependencies for known security vulnerabilities. Reports findings in the GitHub Security tab.

**Why this matters:** External packages (libraries you install) sometimes have security flaws discovered after you install them. This check catches them automatically.

**Note:** This will not block deployments in Level 1. It reports findings for your review. In Level 3, critical vulnerabilities can block deploys.

---

## Level 2 Actions (Implement After First 10 Paying Users)

### Action D: Automated Release Notes

**Trigger:** Merge to `main`

**What it does:**
- Reads all commit messages since the last release
- Groups them by type (feature, fix, chore)
- Creates a GitHub Release with formatted notes
- Tags the commit with the version number

**Claude Code role:** Claude Code should draft the release notes text as part of any major PR description. The action formats and publishes them.

---

### Action E: Worker Deployment Validation

**Trigger:** Any change to files inside `workers/`

**What it does:**
- Detects that Worker code changed
- Runs `wrangler deploy --dry-run` to verify the Worker would compile
- Reports any Worker-specific errors

**Why:** Next.js builds and Worker builds are separate. A broken Worker does not fail the Next.js build check. This catches Worker errors before you manually deploy.

---

### Action F: Environment Variable Verification

**Trigger:** Every PR to `main`

**What it does:**
- Checks that all required environment variables are set in Cloudflare Pages
- Reports any missing variables before deploy

**Why:** A missing environment variable causes silent failures (app loads but nothing works). Better to catch it in the pipeline.

---

## Level 3 Actions (Implement After V1.5 Is Stable)

### Action G: End-to-End Test Suite

**Trigger:** Every PR to `main`

**What it does:**
- Launches the app in a headless browser (Playwright)
- Runs critical flows automatically:
  - Can the signup page load?
  - Does the character creation form submit?
  - Does the dashboard load characters?
- Reports pass/fail per flow

**Why this is Level 3:** Writing tests takes significant time. Building the product comes first. Tests are most valuable when the product is stable and you are protecting it from regressions.

---

### Action H: Performance Budget

**Trigger:** Every PR to `main`

**What it does:**
- Builds the app and measures JavaScript bundle size
- Fails if total bundle size exceeds a threshold (e.g. 500KB)
- Prevents the app from becoming slow over time

---

### Action I: Automated Preview Comments

**Trigger:** Every PR to `develop`

**What it does:**
- Posts a comment on the PR with the Cloudflare preview URL
- Example: "Preview deployed at: https://abc123.personalityos.pages.dev"
- Clicking the link opens the specific preview for that PR

**Why useful for a solo founder:** You immediately know the preview URL without going to Cloudflare dashboard.

---

## What Actions Cannot Replace

Even at Level 3, the following must always be done by you manually:

| Action | Why You Must Do It |
|---|---|
| Merging develop → main | Production deploy affects real users. Always a human decision. |
| Approving PRs | You must read what Claude Code wrote. Never auto-approve. |
| Setting environment variables | Contains API keys. Never automated. |
| Rollback decisions | Requires judgment about impact. Always human. |
| Wrangler deploy (Worker) | Separate from Pages. Always manual. |
| Creating Supabase migrations | Schema changes are irreversible. Always reviewed. |

---

## Preparing for Level 1 Implementation

When you are ready to implement Level 1, tell Claude Code:

```
I am ready to implement Level 1 GitHub Actions as specified in
docs/GITHUB_ACTIONS_PLAN.md.

Please:
1. Create .github/workflows/pr-validation.yml
2. Create .github/workflows/security-audit.yml
3. Add "type-check" and "lint" scripts to package.json
4. Create .eslintrc.json with Next.js + TypeScript recommended config
5. Verify the build script runs correctly locally first

Do NOT implement Level 2 or Level 3 items.
Explain each step before writing any file.
```

---

## Cost Estimate for GitHub Actions

| Level | Minutes Used / Month | Cost |
|---|---|---|
| Level 1 | ~200-500 minutes | Free (under 2,000 limit) |
| Level 2 | ~500-1,000 minutes | Free |
| Level 3 (with E2E tests) | ~1,000-2,000 minutes | Free to low ($0-4/month) |

GitHub's free tier (2,000 minutes/month on public repos, 2,000 on private) covers all three levels for a solo project.

---

## Summary: What to Implement, When

```
Now (Day 1):          Branch protection rules (GitHub Settings, not Actions)
                      .gitignore and .env.local setup

After V1 deploys:     Level 1 — PR validation (lint + type-check + build)
                      Level 1 — Branch protection enforcement in Actions

After 10 paying:      Level 2 — Release notes, Worker validation

After V1.5 stable:    Level 3 — E2E tests, performance budget
```
