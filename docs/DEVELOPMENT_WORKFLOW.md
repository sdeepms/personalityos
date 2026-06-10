# PersonalityOS — Development Workflow

**Audience:** Solo founder, non-software background
**Last Updated:** June 2026

---

## The One Sentence That Governs Everything

> Claude Code writes the code. You review it. Git commits it. GitHub stores it. Cloudflare deploys it.

You are the architect and decision-maker. Claude Code is the implementation team. This document tells both of you exactly how to work together.

---

## The Golden Flow

```
You describe a task
        ↓
Claude Code writes the code (in a feature branch)
        ↓
You read and understand the changes
        ↓
You test it in the browser
        ↓
You run: git add . && git commit -m "message"
        ↓
You run: git push
        ↓
Cloudflare automatically deploys
```

**The handoff between you and Claude Code is always at the commit step.** Claude writes. You commit. This is the safety valve that prevents accidental code loss and broken deployments.

---

## Part 1: Daily Development Workflow

### Every Morning (15 minutes)

```bash
# 1. Open your terminal
cd ~/Documents/Projects/personalityos

# 2. Sync the latest code from GitHub
git pull origin develop

# 3. Check what branch you are on
git branch
# You should see: * develop

# 4. Create a branch for today's task
git checkout -b feature/[describe-what-you-are-building-today]
# Example: git checkout -b feature/character-creation-form

# 5. Start the development server
npm run dev
# Keeps running in this terminal window. Do not close it.

# 6. Open a second terminal window for commands
cd ~/Documents/Projects/personalityos

# 7. Start Claude Code
claude
# Give it the daily context prompt (see Part 2 below)
```

**Why create a new branch every day?**
A branch is like a parallel workspace. Whatever Claude builds today stays isolated from the working code on `develop`. If something goes wrong, you can delete the branch and start over. The working code is untouched.

---

### During the Day (Repeating Cycle)

```
1. Describe one small task to Claude Code
2. Claude writes the code
3. You READ the changes (ask Claude to explain anything unclear)
4. You TEST in the browser (open localhost:3000)
5. If it works → commit
6. If it doesn't work → describe the problem to Claude, repeat from step 2
```

**The most important habit:** Never describe the next task to Claude until the previous one is committed. One task at a time. This keeps your git history clean and makes it easy to undo mistakes.

---

### Committing Work (After Each Working Change)

```bash
# See what changed
git status

# Stage all changes
git add .

# Commit with a meaningful message
git commit -m "Add character creation form with DNA fields"
```

**Commit message rules (explained below in the Claude Engineering Guide, but summarised here):**
- Use present tense: "Add" not "Added"
- Be specific: "Add character creation form" not "stuff"
- One sentence, under 60 characters

---

### End of Day (15 minutes)

```bash
# 1. Make sure everything is committed
git status
# Should show: "nothing to commit, working tree clean"

# 2. Push your branch to GitHub
git push -u origin feature/[your-branch-name]
# After the first push, future pushes just need: git push

# 3. Go to github.com → your repository
# GitHub will show a banner: "Compare & pull request" → click it
# Title: describe what you built today
# Body: paste in what Claude Code says was completed

# 4. Review the "Files changed" tab
# This shows every line you added (green) or removed (red)
# This is your daily code review

# 5. If everything looks right → Merge the PR into develop
# develop branch now has your work
# Cloudflare preview deployment triggers automatically

# 6. Back in terminal:
git checkout develop
git pull origin develop
# Your feature branch work is now on develop locally too

# 7. Write in your daily log (see template at the bottom)
```

---

## Part 2: Claude Code Workflow

### Daily Context Prompt (Start Every Session With This)

```
I am building PersonalityOS — a Digital Identity OS for AI content creators.

Read these documents before we start:
- docs/PRODUCT_VISION.md
- docs/MVP_SCOPE.md
- docs/DATABASE_SCHEMA.md
- docs/SYSTEM_ARCHITECTURE.md
- .claude/project.md (operating rules for this session)

Current project phase: [V1 Build — Day X of 14]
Current branch: feature/[branch-name]

Already completed:
- [list what is working]

Today's task:
- [one specific task]

Do NOT begin writing code until you confirm you have read the docs.
When ready, summarise what we are building in two sentences.
```

**Why this prompt matters:** Claude Code has no memory between sessions. Without context, it invents solutions that contradict your architecture. This prompt anchors every session to your actual decisions.

---

### How to Give Claude a Task

**Too vague (Claude will guess wrong):**
```
Build the chat interface
```

**Specific enough (Claude will get it right):**
```
Build the Chat Studio page at app/dashboard/[characterId]/chat/page.tsx

This page needs:
- A header with the character name and avatar
- Platform shortcut buttons: Instagram Post, LinkedIn Post, X Thread, Carousel, Story
- A scrollable area showing previous generations
- A fixed text input at the bottom

The platform shortcuts pre-fill the input with "Create a [platform] post about: "
The component should use shadcn/ui Card, Button, Textarea
Dark theme: background #0a0a0a, surface #141414
```

---

### When Claude Makes a Mistake

Do not just ask it to "fix it." Describe what you expected vs what you got:

```
The submit button works but after clicking it, the page goes blank.
I expected it to redirect to /dashboard.
What is causing this and how do we fix it?
```

Then: understand the explanation before accepting the fix.

---

### Asking for Explanations

Before committing any code you don't understand:

```
Explain what this function does in plain English.
No code. No jargon. Explain it as if I am a mechanical engineer
who has never written software.
```

This is not optional. You must understand what is in your codebase.

---

## Part 3: Git Workflow

### The Three Branches

```
main          ← Production. Only merged from develop. Always working.
develop       ← Integration. Claude's finished work lands here.
feature/*     ← Daily work. One branch per task. Deleted after merge.
```

**You never develop directly on main or develop.**
**Claude Code always works on feature/* branches.**

---

### Everyday Commands Reference

```bash
# Check where you are
git branch
git status

# Create and switch to a new feature branch
git checkout -b feature/[task-name]

# See what changed
git diff

# Stage and commit
git add .
git commit -m "Your message here"

# Push to GitHub
git push                     # after first push
git push -u origin feature/[name]  # first time

# Switch back to develop
git checkout develop
git pull origin develop

# Merge develop into main (only when ready for production)
git checkout main
git merge develop
git push
```

---

### If Something Goes Wrong

**Undo the last commit (keeps the code, removes the commit):**
```bash
git reset --soft HEAD~1
```

**Throw away all uncommitted changes (nuclear option — cannot undo):**
```bash
git restore .
```

**Start a feature branch over completely:**
```bash
git checkout develop          # go back to develop
git branch -D feature/[name]  # delete the bad branch
git checkout -b feature/[name] # start fresh
```

---

## Part 4: Review Process

### What to Review Before Every Commit

Run through this checklist mentally before every `git commit`:

**Functionality:**
- [ ] Did I test this in the browser?
- [ ] Does the thing I built actually work?
- [ ] Are there any obvious error states I didn't handle?

**Safety:**
- [ ] Does `git status` show any `.env.local` or `.dev.vars` files? (If yes — STOP. Do not commit. Add them to `.gitignore` first.)
- [ ] Is any API key visible in the changed files?

**Understanding:**
- [ ] Can I explain what each changed file does?
- [ ] If not, did I ask Claude Code to explain it?

---

### What to Review in GitHub Pull Requests

Every PR (pull request — the proposal to merge a branch into develop) should be reviewed using the "Files changed" tab.

Look for:
- Lines you don't recognise
- Files that shouldn't have changed
- Any text that looks like a password, API key, or secret
- Changes to `wrangler.toml` (deployment config — review carefully)
- Changes to `middleware.ts` (auth — review carefully)

If you see something you don't understand: ask Claude Code to explain it before merging.

---

## Part 5: Deployment Process

### The Automatic Path (What Happens After Every Push)

```
You push to feature branch
        ↓
Pull Request created on GitHub
        ↓
You merge PR into develop
        ↓
Cloudflare auto-deploys develop to PREVIEW URL
(preview URL: develop.personalityos.pages.dev)
        ↓
You test the preview URL
        ↓
When V1 milestone is complete:
You merge develop into main
        ↓
Cloudflare auto-deploys main to PRODUCTION URL
(production URL: personalityos.pages.dev)
```

**You never deploy manually.** The GitHub push triggers Cloudflare. This is automatic and safe.

---

### Before Merging develop → main (Production Deploy)

This is the only deploy that reaches real users. Run the Quality Agent checklist first:

- [ ] Full end-to-end test in an incognito browser window
- [ ] No API keys visible in source code
- [ ] All core flows working: signup, create character, upload photo, generate post, view library
- [ ] Error states show friendly messages
- [ ] Mobile layout tested at 375px width

Only after all checks pass: merge develop → main.

---

## Daily Log Template

Keep this in a notes app or physical notebook. Fill it out every day.

```
Date:
Day in 14-Day Plan:

Today's goal:

What Claude built:

What I committed:

What is NOT finished (move to tomorrow):

Bugs found:

Something I don't understand yet:

Tomorrow's first task:

Git commits today:
1.
2.
3.
```

---

## Quick Reference Card (Print This)

```
MORNING
git pull origin develop
git checkout -b feature/[task]
npm run dev  (keep open)
claude       (start session with context prompt)

DURING DAY
Claude writes → You read → You test → git add . && git commit -m "..."

END OF DAY
git push
Create PR on GitHub
Review "Files changed"
Merge PR into develop
git checkout develop && git pull

PRODUCTION DEPLOY (milestones only)
Merge develop → main on GitHub
```
