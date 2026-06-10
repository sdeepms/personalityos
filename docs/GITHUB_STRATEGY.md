# PersonalityOS — GitHub Branch Strategy

**Audience:** Solo founder + Claude Code
**Last Updated:** June 2026

---

## The Three-Branch System

```
main ──────────────────────────────────────────→  PRODUCTION
  ↑                                               (real users)
  │  merge (milestone only, manual, reviewed)
  │
develop ───────────────────────────────────────→  PREVIEW
  ↑                                               (your testing)
  │  merge (daily, after PR review)
  │
feature/* ─────────────────────────────────────→  (no deploy)
           (Claude works here)
```

This system has one rule at its core:

> **main is always production-ready. develop is always stable. feature/* is where work happens.**

---

## Branch 1: `main`

### What It Is
The production branch. What is on `main` is what real users see.

### Rules
- **Never commit directly to main.** Not even a small fix. Always go through develop first.
- Only merge from `develop`, never from feature branches directly.
- Every merge to main triggers a production deployment on Cloudflare Pages.
- Only merge at milestones (end of V1, end of a phase), not daily.

### Who merges to main?
You, the founder. Never Claude Code. This is a deliberate human checkpoint before real users are affected.

### Protection (to set up on GitHub — instructions in CLOUDFLARE_DEPLOYMENT.md):
- Require pull request before merging
- Require at least one approval (you approve your own PR for solo work)
- Block direct pushes

---

## Branch 2: `develop`

### What It Is
The integration branch. All feature work lands here first. This is where you test before promoting to production.

### Rules
- Claude Code never commits directly to develop.
- Feature branches are merged into develop via Pull Requests.
- You must review and approve every PR before merging.
- develop should always be in a runnable state (no broken builds).
- Every push to develop triggers a preview deployment on Cloudflare Pages.

### When something breaks on develop
That is fine. develop is your testing ground. Fix it on a new feature branch, merge back to develop. Never panic about develop being broken — that is what it is for.

---

## Branch 3: `feature/*`

### What It Is
Daily work branches. Claude Code writes all code here. One branch per task or per day.

### Naming Convention

```
feature/[task-description]

Examples:
feature/character-creation-form
feature/reference-image-upload
feature/provider-adapter
feature/chat-studio-ui
feature/asset-library
feature/day-7-prompt-dna

fix/[what-you-are-fixing]

Examples:
fix/login-redirect
fix/image-generation-timeout
fix/library-pagination

chore/[maintenance-task]

Examples:
chore/update-dependencies
chore/cleanup-unused-imports
chore/add-env-example-file
```

### Rules
- Create a new feature branch every time you start a new task.
- Claude Code works only on the current feature branch.
- Never let Claude commit to develop or main directly.
- Delete feature branches after they are merged (keeps the repository clean).
- If a branch is abandoned, delete it — do not let stale branches accumulate.

---

## The Merge Lifecycle

### Step 1: Feature branch → develop (Daily)

```
Trigger: You finished a task and it works in the browser

Actions:
1. git push -u origin feature/[name]
2. GitHub → "Compare & pull request" banner appears
3. Create PR: title = what you built, body = Claude's summary
4. Review "Files changed" tab
5. Merge PR → "Squash and merge" (keeps develop history clean)
6. Delete the feature branch (GitHub shows a "Delete branch" button after merge)

Who approves: You
Time this takes: 5-10 minutes
```

**What "Squash and merge" means:** All the commits on your feature branch get combined into one commit on develop. So instead of seeing "WIP", "fix typo", "try this", "actually fix it" in your history, you see one clean commit: "Add character creation form". Much easier to understand later.

---

### Step 2: develop → main (Milestones Only)

```
Trigger: You completed a milestone
(end of V1 Phase 1, end of V1 build, V1.5, V2, etc.)

Pre-conditions (ALL must be true):
- Full end-to-end test passed in incognito window
- Quality Agent checklist complete
- No open Critical or High bugs
- Preview URL tested with at least one real user flow

Actions:
1. git checkout main → git pull
2. On GitHub: Create PR from develop → main
3. Title: "V1.0 Release" or "Milestone: [name]"
4. Body: List of everything that is included
5. Review the PR carefully
6. Merge → "Merge commit" (not squash — keep the develop history)
7. Cloudflare production deploy triggers automatically
8. Test the production URL within 5 minutes

Who approves: You, consciously, with full checklist
Time this takes: 30-60 minutes including testing
```

---

## Branch Protection Settings (GitHub)

Set these up on Day 1 at github.com → Settings → Branches.

### For `main`:
```
Branch name pattern: main
☑ Require a pull request before merging
  ☑ Require approvals: 1
☑ Require status checks to pass before merging
  (add these when GitHub Actions are configured)
☑ Restrict who can push to matching branches
  (only you)
☑ Block force pushes
```

### For `develop`:
```
Branch name pattern: develop
☑ Require a pull request before merging
☑ Block force pushes
```

**What "block force pushes" means:** A force push (`git push --force`) rewrites history — it is the most dangerous git operation because it can permanently delete commits. This setting makes that impossible, protecting your code even if Claude Code suggests a force push.

---

## The Complete Branch Diagram

```
Day 1
  main ──────────────────────────────────────────────────────→
  develop ────────────────────────────────────────────────────→
             ↑
          initial setup merged

Day 3 (Character Creation)
  feature/character-creation-form
             │── Claude works here (5-8 commits over the day)
             │
             └──→ PR → develop ──────────────────────────────→
                        ↑
                     you merged and tested
                     Cloudflare preview deployed

Day 5 (Provider Adapter)
                        feature/provider-adapter
                             │── Claude works here
                             │
                             └──→ PR → develop ─────────────→
                                        ↑
                                     you merged

Day 7 (First working generation - Milestone)
                                        ↑
                                 develop → main (PR)
                                 Cloudflare PRODUCTION deployed
                                 ↑
                              V1 Phase 1 complete

Day 8 (Chat Studio)
                                               feature/chat-studio
                                                    │── Claude
                                                    │
                                                    └──→ PR → develop →
```

---

## Answering Common Questions

**Can Claude Code commit directly to develop or main?**
No. Claude Code only works on feature branches. All merges go through PRs that you review and approve.

**What if I want to make a tiny fix quickly?**
Still create a branch. Even for one line. The habit is more important than the speed. A one-line fix on main that breaks authentication will cost you two hours. Thirty seconds to create a branch is always worth it.

**What if I accidentally commit to develop directly?**
Do not panic. The code is not lost. Create a feature branch from your current position, then use `git reset --hard HEAD~1` on develop to undo. Ask Claude Code to help if you are unsure.

**When should I delete feature branches?**
Immediately after merging. GitHub shows a "Delete branch" button after every merge. Click it every time. A clean repository with 3 branches is much easier to understand than one with 40 stale branches.

**How many commits per day is normal?**
Between 3 and 10. Each meaningful working change should be its own commit. Do not wait until end-of-day to commit — commit each time something new works.
