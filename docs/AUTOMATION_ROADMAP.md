# PersonalityOS — Automation Roadmap

**Audience:** Solo founder planning workflow evolution
**Last Updated:** June 2026

---

## The Core Philosophy

Automate repetitive tasks that are error-prone when done manually.
Never automate decisions that require judgment.

The question to ask before automating anything:
> "If this automation runs without my attention and something goes wrong, what is the worst outcome?"

If the worst outcome is "a bad deployment reaches real users" or "API keys get exposed" — do not automate. If the worst outcome is "I get a Slack message I can ignore" — automate freely.

---

## Current State (Before Any Automation)

```
Every action requires your manual attention:
- git add . && git commit → you run it
- git push → you run it
- PR creation → you create it on GitHub
- PR review → you review it
- PR merge → you click merge
- Worker deploy → you run wrangler deploy
- Testing → you do it in the browser
```

This is the right starting point for a non-technical founder learning the system. You understand every step because you do every step. Automation before understanding creates invisible failure modes.

---

## Level 1: Foundation Automation (Implement Now)

**Principle:** Automate infrastructure setup. Require human approval for every code change.

### What Gets Automated

**A. Cloudflare Pages auto-deploy (set up on Day 12)**
```
When you merge a PR to develop → Cloudflare auto-deploys to preview URL
When you merge a PR to main → Cloudflare auto-deploys to production
You never run a deploy command for the frontend.
```

**Why this is safe to automate:** Deployment to preview is low risk. Deployment to production is gated by your PR merge decision — you are still the decision-maker, the deploy just happens automatically after you decide.

**B. Branch protection rules (set up on Day 1)**
```
GitHub prevents direct pushes to main and develop
All merges require a PR
PRs cannot be merged unless a build check passes (Level 1 GitHub Actions)
```

**Why this is safe to automate:** It enforces discipline automatically. You cannot accidentally break things by pushing directly to main.

**C. Cloudflare failure notifications (set up on Day 12)**
```
When a deployment fails → email sent to you automatically
You investigate when you get the email
```

**Why this is safe to automate:** Notification is not action. You still decide what to do.

---

### What Requires Your Manual Approval

In Level 1, everything else requires your decision:

| Action | Why Manual |
|---|---|
| `git add .` | You choose what to stage |
| `git commit -m "..."` | You write the message, you own the history |
| `git push` | You choose when to upload |
| Create PR | You write the PR description |
| Merge PR | You reviewed the code |
| `wrangler deploy` (Worker) | Backend deployment, more risk |
| Set environment variables | Contains secrets |
| Approve new dependencies | Affects security surface |

---

### The Ideal Level 1 Flow

```
Claude writes code
    ↓
You read and understand it
    ↓
You run: npm run dev → test in browser
    ↓
You run: git add . && git commit -m "message"
    ↓
You run: git push
    ↓
GitHub receives push
    ↓  (AUTOMATED FROM HERE)
PR validation runs (lint + type check + build) — 2 minutes
    ↓
You review the PR on GitHub (read Files Changed)
    ↓
You click Merge
    ↓
Cloudflare deploys automatically — 2 minutes
    ↓
Preview URL is live for testing
```

**Your total active time per feature:** ~15-30 minutes of decisions, reviewing, and testing. The rest is automated waiting.

---

## Level 2: Assisted Automation (After V1 Deploys to Real Users)

**Principle:** Claude Code assists with mechanical tasks. You approve everything before it takes effect.

**Trigger to unlock Level 2:** V1 has been live for at least 2 weeks. You are comfortable with the git workflow. You have successfully done 5+ rollbacks and PR merges.

---

### What Gets Automated

**A. PR description drafting (Claude Code)**

At end of session, instead of writing the PR description yourself, you ask Claude:

```
Please write a PR description for the changes in this session.
Include: what was built, what was changed, how to test it.
```

You copy the description into GitHub when creating the PR. You still review it.

**B. Commit message suggestions (Claude Code)**

Claude suggests the commit message after each working unit. You approve it or edit it. You run the git commit command.

**C. Automated release notes (GitHub Actions)**

When you merge to main, a GitHub Action reads the commit messages since the last release and creates a formatted GitHub Release page. No action needed from you — it just happens.

**D. Worker deployment validation (GitHub Actions)**

When Worker files change, a GitHub Action runs `wrangler deploy --dry-run` and reports if the Worker would compile. Prevents you from pushing broken Worker code before deploying.

---

### What Still Requires Your Approval

In Level 2, the merge decision always stays with you:

| Stays Manual | Reason |
|---|---|
| PR merge → develop | Code review must be human |
| PR merge → main | Production deploy = human decision |
| `wrangler deploy` | Backend deploy = human command |
| Environment variable changes | Secrets = human management |
| Database migrations | Irreversible = human review |

---

### The Level 2 Flow

```
Claude writes code
    ↓
You test in browser
    ↓
Claude suggests: commit message, PR description
    ↓
You run: git add . && git commit -m "[Claude's suggested message]"
    ↓
You run: git push
    ↓ (AUTOMATED)
PR validation runs
Claude's PR description auto-populates (via GitHub template)
    ↓ (YOUR DECISION)
You review and merge PR
    ↓ (AUTOMATED)
Cloudflare deploys
Release notes generated (on main merge)
```

---

## Level 3: Production Automation (After V1.5 Is Stable)

**Principle:** GitHub Actions handles validation, testing, and monitoring. You only review and decide.

**Trigger to unlock Level 3:** V1.5 is live. You have at least 25 active users. The codebase is stable enough to write tests against.

---

### What Gets Automated

**A. End-to-end test suite (Playwright)**

GitHub Actions runs automated browser tests on every PR to main:
- Can signup page load?
- Does character creation form work?
- Does the chat generate a caption?
- Does the library show past generations?

If any test fails → PR is blocked. You cannot merge broken code to production.

**B. Performance monitoring**

Every PR to main gets a performance report: JavaScript bundle size, load time, core web vitals. Flagged if above threshold.

**C. Security dependency scanning**

Automated weekly scan of dependencies for known vulnerabilities. You get a GitHub issue if any critical vulnerability is found.

**D. Automated preview URLs per PR**

Every PR gets its own preview URL (via Cloudflare Pages preview). Comment posted to PR automatically. You test directly from the PR page.

---

### The Level 3 Flow

```
Claude writes code
    ↓
You test in browser
    ↓
You commit and push
    ↓ (AUTOMATED — 5 minutes)
PR validation: lint + type check + build
E2E tests run
Performance check runs
Preview URL created
PR comment: "All checks passed. Preview: https://..."
    ↓ (YOUR DECISION)
You review the diff and the automated test results
You click merge
    ↓ (AUTOMATED — 2 minutes)
Production deploy
Release notes generated
Monitoring dashboard updated
```

---

## What Should NEVER Be Automated (All Levels, Forever)

These actions require human judgment regardless of how mature the automation is:

| Action | Risk If Automated | Why It Must Stay Manual |
|---|---|---|
| Merging to main | Broken code reaches real users | Requires human review of the diff |
| Setting environment variables | Exposes API keys incorrectly | Secrets management is always human |
| Running database migrations | Schema changes are irreversible | A bad migration can destroy user data |
| Deleting R2 assets | Permanent data loss | User assets are permanent by design |
| Responding to user complaints | Requires empathy and context | Cannot be scripted |
| Approving new dependencies | Security risk assessment | Requires evaluating trust and necessity |
| Financial decisions | Real money | Always the founder's decision |
| Deciding what to build next | Product judgment | Always the founder's vision |

---

## Migration Guide: Moving Between Levels

### Level 0 → Level 1
1. Set up Cloudflare Pages auto-deploy (see CLOUDFLARE_DEPLOYMENT.md)
2. Set up branch protection rules on GitHub (Settings → Branches)
3. Enable Cloudflare failure notifications
4. That's it. Level 1 is live.

### Level 1 → Level 2
Prerequisites:
- V1 deployed and stable for 2+ weeks
- You have done at least 5 PR merges manually
- You understand the git workflow well enough to explain it

Steps:
1. Tell Claude Code: "Implement Level 1 GitHub Actions as specified in docs/GITHUB_ACTIONS_PLAN.md"
2. Start using Claude's commit message suggestions
3. Start asking Claude to draft PR descriptions

### Level 2 → Level 3
Prerequisites:
- At least 25 active users
- V1.5 is stable and deployed
- You have budget and time to write E2E tests

Steps:
1. Tell Claude Code: "Implement Level 2 and Level 3 GitHub Actions as specified in docs/GITHUB_ACTIONS_PLAN.md"
2. Review and approve each automation before it goes live
3. Test each automated check manually before relying on it

---

## The Automation Decision Matrix

Use this to decide whether to automate something:

| Question | Automate? |
|---|---|
| Does it require judgment? | No |
| Does failure affect real users immediately? | Only if gated by human approval |
| Does failure cause data loss? | No |
| Does it involve secrets or credentials? | No |
| Would you do it the same way every single time? | Yes |
| Can you explain exactly what it does? | Yes |
| Can you reverse it if it goes wrong? | Yes |

All "No" answers on risk questions + all "Yes" answers on ability questions = safe to automate.

Any "Yes" on a risk question = requires human step in the loop.
