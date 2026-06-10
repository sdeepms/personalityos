# PersonalityOS — The Complete Beginner's Guide

**Document Type:** Learning Reference + Mentor Guide
**Audience:** Non-technical founder building for the first time
**Tone:** Mentor teaching a motivated beginner
**Last Updated:** June 2026

---

## A Note Before You Begin

You are a Mechanical Engineer. You understand systems. You understand how parts connect. You understand tolerances, failure points, and the importance of reading the manual before operating the machine.

Software development is exactly the same. Every technology is a system. Every tool has a purpose. Every command does exactly one thing. Nothing is magic.

This guide treats you as what you are — an intelligent adult who is new to one domain. It will explain everything from first principles, with analogies drawn from the physical world you already understand.

Read this guide once, end to end, before you write a single line of code. Then return to specific sections whenever you are confused.

**The most important thing you will learn here is not any specific command. It is the mental model — how all the pieces fit together.**

---

# PART 1: THE TERMINAL

## What Is the Terminal?

The Terminal (also called Command Line, Shell, or Console) is a text-based way to talk to your computer. Instead of clicking icons with a mouse, you type instructions.

**The Mechanical Engineer Analogy:**

Think of your computer's graphical interface (the desktop with icons) as the dashboard of a car. You can turn on the air conditioning, change the radio station, and adjust the seat — all through easy buttons and dials. But if you need to actually work on the engine, you open the hood and work directly with the components. The Terminal is opening the hood.

You cannot build software through the dashboard. You need the hood.

---

## Opening the Terminal

**On a Mac:**
- Press `Command + Space` to open Spotlight
- Type "Terminal" and press Enter
- A black or white window opens with a blinking cursor

**On Windows:**
- Press `Windows Key + R`
- Type "cmd" and press Enter
- Or search for "PowerShell" in the Start menu
- Recommendation: install Windows Terminal from Microsoft Store — it is much better

**What you see:**
```
yourname@MacBook-Pro ~ %
```

This is called the **prompt**. It is waiting for you to type a command. The `~` means you are currently in your home folder (the one with your Documents, Downloads, Desktop).

---

## Terminal Basics: The Commands You Will Actually Use

There are only about 10 terminal commands you need to know for this project.

---

### `pwd` — Where Am I?

pwd stands for "Print Working Directory." It tells you which folder you are currently inside.

```
pwd
```

Output example:
```
/Users/yourname
```

**Analogy:** You are standing somewhere in a large building. `pwd` is asking "what room am I in?" The answer is the full address of the room.

---

### `ls` — What Is in This Folder?

ls stands for "list." It shows you the files and folders in your current location.

```
ls
```

Output example:
```
Desktop    Documents    Downloads    personalityos
```

**Analogy:** Opening a drawer and looking at what is inside.

Useful variation: `ls -la` shows hidden files too, with details like file sizes.

---

### `cd` — Move to a Different Folder

cd stands for "Change Directory." It moves you from your current folder to another.

```
cd Documents              # move into the Documents folder
cd personalityos          # move into the personalityos folder
cd ..                     # go UP one level (back to parent folder)
cd ~                      # go back to your home folder, from anywhere
```

**Analogy:** Walking from one room to another in the building. `cd ..` is walking out of the current room into the hallway.

**Common Mistake:** Trying to `cd` into a folder that does not exist. Always `ls` first to confirm the folder name. Folder names are case-sensitive on Mac — `Documents` and `documents` are different folders.

---

### `mkdir` — Create a New Folder

mkdir stands for "Make Directory."

```
mkdir personalityos        # creates a folder named personalityos
mkdir workers              # creates a folder named workers
```

---

### `clear` — Clean the Screen

When the terminal gets cluttered with old output, type `clear` or press `Control + L`. Does not delete anything — just cleans the visual display.

---

### `npm` — The Package Manager

npm is the App Store for code. You use it to install libraries, run your project, and build for deployment.

```
npm install                           # install all libraries listed in package.json
npm install @supabase/supabase-js     # install one specific library
npm run dev                           # start the development server
npm run build                         # build for production
```

**What is package.json?** A file that lists all the libraries your project needs, like a shopping list. When you run `npm install`, npm reads the list and downloads everything.

---

### The Tab Key — Your Best Friend

When typing a folder or file name, press **Tab** to autocomplete.

```
cd Doc[TAB]    becomes    cd Documents/
```

If there are multiple matches, press Tab twice to see all options. Use this always.

---

### Up Arrow — Repeat Previous Commands

Press the **Up Arrow** key to cycle through your previous commands. Press Enter to run the selected one again.

---

## Common Terminal Mistakes

**Mistake 1: Running a command in the wrong folder**

The most common beginner mistake. Always know where you are before running commands.

Wrong approach:
```
npm run dev
Error: "npm could not find package.json"
```

Right approach:
```
pwd                          # check where you are
cd personalityos             # move to project folder
npm run dev                  # now it works
```

**Mistake 2: Closing the terminal while a server is running**

When you run `npm run dev`, the terminal is occupied — it is running a server. If you close it, the server stops. Keep that window open. Open a new terminal window for other commands.

**Mistake 3: Forgetting that folder names are case-sensitive**

On Mac and Linux, `Documents`, `documents`, and `DOCUMENTS` are three different folders.

---

# PART 2: GIT

## What Is Git and Why Do You Need It?

Git is a version control system. It tracks every change you make to your code over time.

**The Analogy:**

Imagine you are writing a long essay. Without Git, you save one file: `essay.docx`. Every time you make changes, you overwrite the old version. If you delete a paragraph and realize later it was important — it is gone forever.

With Git, every time you save your progress, Git takes a snapshot of every file. If you delete something important, you can go back to any previous snapshot. If you try something experimental and it breaks everything, you can restore the last working version in 10 seconds.

**Three reasons you need Git even as a solo developer:**

1. Safety net — You can experiment without fear. Everything is recoverable.
2. History — You can see exactly what changed, when, and why.
3. Deployment — Cloudflare Pages deploys automatically when you push code to GitHub. No git = no deployment.

---

## The Core Mental Model: Snapshot, not Backup

Git does not make backups continuously. You decide when to take a snapshot. Each snapshot is called a **commit**.

A commit captures:
- The exact state of every file at that moment
- Who made the change (your name and email)
- When the change was made
- A message you write describing what changed

Your project history is a sequence of commits:

```
Commit 1: "Initial project setup"
    |
Commit 2: "Added Expert database table"
    |
Commit 3: "Built Expert creation form"
    |
Commit 4: "Fixed bug in form validation"
    |
[current state — not yet committed]
```

You can jump to any commit in this history.

---

## The Three Zones of Git

Before learning commands, understand these three zones. This is the concept most beginners skip — and then they are confused for months.

```
YOUR COMPUTER
--------------------------------------------------
Zone 1: Working Directory
  Your actual files.
  You edit these directly.
  Git watches them but has not saved changes yet.

        |
        |  git add
        v

Zone 2: Staging Area
  Changes you have "selected" to save.
  Like putting items in a box before shipping.
  Can add more or remove items.

        |
        |  git commit
        v

Zone 3: Local Repository (.git folder)
  The permanent history on your computer.
  Sealed, immutable snapshots.
  All your commits live here.

        |
        |  git push
        v

GITHUB (Remote Repository)
  A copy of your history in the cloud.
  Safe backup.
  Triggers Cloudflare deployments.
```

**The flow is always:**
Edit files → `git add` (stage) → `git commit` (save locally) → `git push` (upload to GitHub)

---

## Essential Git Commands

### Setting Up Git — One Time Only

```
git config --global user.name "Your Full Name"
git config --global user.email "your@email.com"
```

This tells Git who you are. Every commit is stamped with this information.

---

### `git init` — Start Tracking a Folder

```
cd personalityos
git init
```

This creates a hidden `.git` folder inside your project. That folder IS the repository. Never delete it. Run this once per project only.

---

### `git status` — What Has Changed?

Run this constantly. It is your compass.

```
git status
```

Example output:
```
On branch main

Changes not staged for commit:
  modified:   app/page.tsx

Untracked files:
  app/dashboard/page.tsx
```

- Modified = file existed before, you changed it
- Untracked = new file, Git has never seen it
- Staged = you ran `git add` on this file, ready to commit

---

### `git add` — Stage Changes

Decide which changes to include in the next commit.

```
git add app/page.tsx              # stage one specific file
git add .                         # stage EVERYTHING that changed
```

Best Practice: Use `git add .` when committing all your work for the day.

---

### `git commit` — Save a Snapshot

```
git commit -m "Add Expert creation form"
```

The `-m` flag means "message." The text in quotes is your description.

**The Golden Rule of Commit Messages:**

Write the message as if completing the sentence: "This commit will..."

Good messages:
- "Add Expert creation form"
- "Fix validation bug in knowledge upload"
- "Connect Supabase to generation worker"

Bad messages:
- "stuff"
- "fix"
- "changes"
- "asdfgh"

Future you will thank present you.

---

### `git log` — See Your History

```
git log --oneline
```

Output:
```
a3f9c12 Fix image download button on mobile
b7e2d01 Add Provider Adapter Layer for MuAPI
c1a8f45 Build knowledge chunking system
d4b3e90 Create Expert database table
e5c2a78 Initial project setup
```

Each line is one commit.

---

### `git push` — Upload to GitHub

```
git push
```

Uploads all your committed changes to GitHub.

First time pushing a new project:
```
git push -u origin main
```

After the first time, just `git push` works.

---

### `git pull` — Download Changes from GitHub

```
git pull
```

Downloads any changes from GitHub not on your computer. Run this every morning before starting.

---

## Common Git Mistakes and How to Fix Them

**Mistake 1: Committing sensitive files**

If you accidentally commit a file containing API keys and push it to GitHub — even for one second — assume those keys are compromised. Rotate them immediately.

Prevention: Always add sensitive files to `.gitignore` before doing anything else.

**.gitignore file contents:**
```
.env.local
.env
node_modules/
.next/
.wrangler/
```

**Mistake 2: "Detached HEAD" state**

Your terminal shows something like `(HEAD detached at a3f9c12)`.

Fix:
```
git checkout main
```

**Mistake 3: Merge conflicts**

Two changes conflict. Git marks the conflicting sections in your file with `<<<<<<` and `>>>>>>` symbols. Open the file, read both versions, manually keep what you want, remove the symbols, save, `git add`, and `git commit`.

Git shows you exactly where the conflict is. Read it, decide what to keep, clean up the markers, commit.

---

# PART 3: BRANCHES

## What Is a Branch?

A branch is a parallel timeline of your project.

**The Analogy:**

Imagine you are writing a book. The main draft is your `main` branch. One day you want to experiment with an entirely new chapter structure. Instead of ruining your existing draft, you make a photocopy and experiment on the copy. If the experiment works, you incorporate it into the original. If it fails, you throw away the copy. Your original is untouched either way.

That photocopy is a branch.

---

## Why Branches Matter for a Solo Developer

Many solo developers skip branches thinking "I am working alone, what is the point?" This is a mistake.

Real scenario:

You are in the middle of building the image generation feature (messy, broken, incomplete). Someone reports a critical bug in the Expert creation form. Without branches, your broken image work mixes with the bug fix.

With branches:
1. Your broken image work stays on a branch called `feature/image-generation`
2. You create a new branch `fix/expert-form-bug` from the clean `main`
3. Fix the bug, merge into `main`
4. Return to `feature/image-generation`

Clean, isolated, safe.

---

## The Branch Model for PersonalityOS

```
main branch (always working, always deployable)
  |
  |-- feature/auth-setup        (merged when working)
  |-- feature/expert-builder    (merged when working)
  |-- feature/knowledge-upload  (in progress)
  |-- fix/generation-bug        (quick fix, merged, deleted)
```

**The rule: `main` is always working. You never develop directly on `main`.**

---

## Branch Commands

### Create and Switch to a New Branch

```
git checkout -b feature/expert-builder
```

Creates the branch AND switches to it. Any commits you make will only affect this branch. `main` is untouched.

**Branch naming convention:**
- `feature/` for new features: `feature/expert-builder`
- `fix/` for bug fixes: `fix/login-redirect`
- `chore/` for maintenance: `chore/update-dependencies`

---

### See All Branches

```
git branch
```

Output:
```
  main
* feature/expert-builder     <- the * shows which branch you are on
  feature/knowledge-upload
```

---

### Switch to an Existing Branch

```
git checkout main
git checkout feature/auth
```

Important: Commit your changes before switching branches.

---

### Merge a Branch into Main

When your feature is done and tested:

```
git checkout main
git merge feature/expert-builder
git push
```

---

### Delete a Branch After Merging

```
git branch -d feature/expert-builder          # delete locally
git push origin --delete feature/expert-builder  # delete on GitHub
```

---

# PART 4: GITHUB

## Git vs. GitHub

**Git** is the tool on your computer that tracks changes.
**GitHub** is a website that stores a copy of your repository online.

**Analogy:** Git is the filing system in your office. GitHub is the same filing system stored in a fireproof vault that anyone you authorize can access from anywhere.

You need GitHub for:
- Cloud backup
- Triggering automatic Cloudflare Pages deployment
- Future collaboration

---

## Pull Requests — What and Why

A Pull Request (PR) is a formal proposal to merge one branch into another. It is GitHub's way of saying: "Here are all the changes I want to add. Please review before merging."

For a solo developer, Pull Requests give you:

1. A visual diff — GitHub shows you exactly what changed, line by line, in green (added) and red (removed)
2. A record — every feature has a documented history
3. A habit — reviewing your own code before merging catches bugs

**How to create a Pull Request:**

1. Push your feature branch: `git push -u origin feature/expert-builder`
2. Go to github.com and open your repository
3. GitHub shows a banner: "feature/expert-builder had recent pushes — Compare & pull request"
4. Click it
5. Write a title: "Add Expert Builder Feature"
6. Write a description: what did you build, what does it do, how to test it
7. Click "Create pull request"
8. Review the "Files changed" tab — read every line you are about to merge
9. Click "Merge pull request"
10. Delete the branch

Make this a habit. Even working alone, reviewing code as a PR catches things you missed during development.

---

## The GitHub Daily Workflow

```
Morning:
1. git pull                            <- get any changes from GitHub
2. git checkout -b feature/[today]    <- create a branch for today's work

During the day:
3. Write code with Claude Code
4. Test in browser
5. git add .
6. git commit -m "meaningful message"
7. Repeat 3-6 as needed

End of day:
8. git push -u origin feature/[today]  <- upload your branch
9. Create Pull Request on GitHub
10. Review the diff
11. Merge PR
12. git checkout main
13. git pull                           <- sync merged changes locally
```

---

# PART 5: CLAUDE CODE

## What Is Claude Code?

Claude Code is an AI assistant that runs in your terminal. It can:
- Read all the files in your project
- Write code directly into your files
- Run terminal commands on your behalf
- Explain what the code does
- Debug errors
- Refactor and improve existing code

Think of it as a senior engineer sitting next to you. You describe the task; they write the code. But you review everything before it runs. You are the architect; Claude Code is the implementation team.

---

## Installing Claude Code

```
npm install -g @anthropic-ai/claude-code
```

Then in any project folder:
```
claude
```

A session starts. You describe what you want. Claude Code reads your project files, writes code, and explains its decisions.

---

## How to Work With Claude Code Effectively

### The Fundamental Mental Model

Claude Code is not a magic button. It is a translator. You have the vision; it translates vision into code. The quality of the translation depends entirely on the quality of your description.

**Precision in, precision out.**

---

### Principle 1: Always Provide Context Before Asking

Bad prompt:
```
Build the expert creation form
```

Claude Code does not know: what fields the form needs, how it connects to the database, what style system you use, or where the file should live.

Good prompt:
```
I am building PersonalityOS — an AI Expert Operating System.
Stack: Next.js 14 with App Router, TypeScript, Tailwind CSS, Supabase.

I need to build the Expert creation form at /dashboard/experts/new

The form must collect:
- name (text input, required)
- bio (textarea, optional)
- expertise (text input, required)
- mission (textarea, optional)
- teaching_style (dropdown: "Socratic", "Direct", "Story-first", "Example-heavy")
- tone (dropdown: "Formal", "Conversational", "Motivational", "Strict")
- comm_style (dropdown: "Bullet-first", "Narrative", "Mixed")

On submit, call POST /api/experts with these fields as JSON.
After success, redirect to /dashboard.

Use Tailwind for styling. Dark theme. Professional.

Create the file: app/dashboard/experts/new/page.tsx
```

This gives Claude Code everything it needs to do the job correctly in one pass.

---

### Principle 2: Reference Your Architecture Documents

You have six architecture documents. Use them. At the start of a session:

```
Before we start, read my project documents:
- DATABASE_SCHEMA.md (exact table structures)
- SYSTEM_ARCHITECTURE.md (how pieces connect)

I want to build [specific thing] next.
```

Claude Code will align its work with your existing decisions. This prevents it from inventing solutions that contradict your architecture.

---

### Principle 3: Break Large Tasks Into Small Pieces

Bad: "Build the entire knowledge upload system"

Good sequence:
1. "Build the Knowledge Worker endpoint that receives a file upload and saves it to Cloudflare R2"
2. "Now add text extraction from the saved PDF"
3. "Now add the chunking function that splits text into 400-word pieces"
4. "Now save each chunk to the knowledge_chunks table in Supabase"

Each small task produces something testable. Test before moving on.

---

### Principle 4: Always Ask For Explanations

If Claude Code writes something you do not understand:

```
Explain what this function does, line by line, in plain English.
No code. Just English.
```

Do not run code you cannot explain. You are the architect. You must understand the building.

---

### Principle 5: How to Give Feedback

When the result is not quite right:

```
This is good but I need to change three things:
1. The form title should say "Create New Expert" not "New Expert"
2. The teaching_style dropdown should default to "Example-heavy"
3. The submit button should be disabled and show a spinner while the API call is in progress

Please update the file with these three changes only. Do not change anything else.
```

Specific. Numbered. Bounded.

---

### Principle 6: Debugging With Claude Code

When you see an error:

```
I got this error when I click the Generate button:
[paste exact error message]

This is the component with the button:
[paste code or tell Claude Code which file to look at]

What does this error mean and how do I fix it?
```

---

## What Claude Code Cannot Do For You

- Make product decisions — which features to build, what users actually need
- Test your product with real users
- Guarantee bug-free code — review everything
- Know your users — that knowledge must come from you in every prompt

---

## The Daily Context Prompt

Start every session with this template:

```
I am building PersonalityOS — an AI Expert Operating System.
Stack: Next.js 14 (App Router), TypeScript, Tailwind CSS,
       Supabase (PostgreSQL + pgvector), Cloudflare Workers, Cloudflare R2.

My project documents are in the docs/ folder.
Please read DATABASE_SCHEMA.md and SYSTEM_ARCHITECTURE.md first.

Today is Day [X] of the 14-Day Plan.
Today's goal: [specific goal]

Already built: [list what is done]
Working on today: [specific task]

Confirm you have read the docs before we begin.
```

---

## Signs You Are Doing It Wrong

**You are building too much at once**
If you cannot describe what you are building in one sentence, break it down.

**You are not testing after each change**
If you build for 2 hours without opening the browser, you will have 10 bugs to find. Build for 20 minutes, test, commit, repeat.

**You are running code you do not understand**
Claude Code writes it; you approve and run it. Ask for explanations on anything unclear.

**You are committing `.env.local`**
Verify `.gitignore` includes `.env.local` on Day 1, before anything else.

**You are developing on `main` branch**
`main` should always be deployable. Always branch for new features.

**You are solving problems by guessing**
Understand the error first. Ask Claude Code to explain the error before asking for a fix.

---

# PART 6: PROJECT ORGANIZATION

## The PersonalityOS Folder Structure

```
personalityos/
|
|-- app/                          <- NEXT.JS PAGES (what users see)
|   |-- layout.tsx                <- Base layout wrapping all pages
|   |-- page.tsx                  <- Root page (redirects to /dashboard)
|   |-- (auth)/
|   |   |-- login/page.tsx        <- /login
|   |   `-- signup/page.tsx       <- /signup
|   `-- dashboard/
|       |-- page.tsx              <- /dashboard (Expert list)
|       |-- experts/
|       |   |-- new/page.tsx      <- /dashboard/experts/new
|       |   `-- [id]/page.tsx     <- /dashboard/experts/abc-123
|       `-- settings/page.tsx     <- /dashboard/settings
|
|-- components/                   <- REUSABLE UI PIECES
|   |-- ui/                       <- Generic components
|   |   |-- Button.tsx
|   |   |-- Input.tsx
|   |   `-- Card.tsx
|   `-- experts/                  <- Expert-specific components
|       |-- ExpertCard.tsx
|       |-- ExpertForm.tsx
|       `-- ExpertHeader.tsx
|
|-- lib/                          <- SHARED UTILITIES
|   |-- supabase/
|   |   |-- client.ts             <- Supabase browser client
|   |   `-- server.ts             <- Supabase server client
|   |-- types.ts                  <- TypeScript type definitions
|   `-- utils.ts                  <- Helper functions
|
|-- workers/                      <- CLOUDFLARE WORKERS (backend)
|   |-- expert-worker/
|   |   |-- src/index.ts
|   |   `-- wrangler.toml
|   |-- knowledge-worker/
|   |   |-- src/index.ts
|   |   `-- wrangler.toml
|   `-- generation-worker/
|       |-- src/index.ts
|       |-- src/providers/
|       |   |-- index.ts          <- Provider Adapter factory
|       |   `-- muapi.ts          <- MuAPI adapter
|       `-- wrangler.toml
|
|-- docs/                         <- ARCHITECTURE DOCUMENTS
|   |-- PRODUCT_VISION.md
|   |-- MVP_SCOPE.md
|   |-- DATABASE_SCHEMA.md
|   |-- SYSTEM_ARCHITECTURE.md
|   |-- BEGINNER_GUIDE.md
|   `-- 14_DAY_EXECUTION_PLAN.md
|
|-- public/                       <- STATIC ASSETS
|-- .env.local                    <- SECRET KEYS (never commit this)
|-- .gitignore                    <- Files Git should ignore
|-- next.config.mjs
|-- tailwind.config.ts
|-- tsconfig.json
`-- package.json
```

---

## File Naming Conventions

| Type | Convention | Example |
|---|---|---|
| React page files | lowercase | page.tsx, layout.tsx |
| React components | PascalCase | ExpertCard.tsx |
| Utility files | camelCase | utils.ts, formatDate.ts |
| Config files | lowercase | next.config.mjs |
| Documentation | UPPER_SNAKE_CASE | PRODUCT_VISION.md |
| Branch names | lowercase-hyphen | feature/expert-builder |
| Commit messages | imperative present | "Add Expert creation form" |

---

## The `.gitignore` File

```
.env
.env.local
.env.*.local
node_modules/
.next/
build/
dist/
.wrangler/
.DS_Store
```

---

# PART 7: TECHNOLOGY REFERENCE

## Quick Reference: Which Technology Does What

| What You Want To Do | Technology |
|---|---|
| Show a page to users | Next.js (app/ folder) |
| Build a UI component | React (.tsx file) |
| Style something | Tailwind CSS (className) |
| Store Expert/Knowledge/Generation data | Supabase (PostgreSQL) |
| Search knowledge by meaning | Supabase (pgvector) |
| Log users in / out | Supabase Auth |
| Store uploaded PDFs | Cloudflare R2 |
| Store generated images | Cloudflare R2 |
| Call Claude for text generation | Anthropic API (from Worker) |
| Generate images | MuAPI via Provider Adapter |
| Handle API requests from frontend | Cloudflare Workers |
| Host the website | Cloudflare Pages |
| Manage version history | Git |
| Store code in the cloud | GitHub |
| Write code with AI assistance | Claude Code |

---

# PART 8: THE DAILY WORKFLOW

## What Every Working Day Looks Like

```
START OF DAY (15 minutes)
----------------------------------------------
1. Open terminal
2. cd personalityos
3. git pull                                    <- sync with GitHub
4. git checkout -b feature/[todays-task]       <- today's branch
5. Open VS Code: type "code ."
6. Open Claude Code: type "claude"
7. Give Claude Code the daily context prompt

DURING THE DAY (repeating cycle)
----------------------------------------------
8.  Describe a small task to Claude Code
9.  Claude Code writes the code
10. Read and understand the code
11. Ask Claude Code to explain anything unclear
12. Run: npm run dev   (frontend)
         wrangler dev  (Worker)
13. Test in browser
14. If it works:
    git add .
    git commit -m "Meaningful message"
15. If it does not work:
    Paste error to Claude Code with context
    Understand the cause before applying the fix
    Repeat from step 9

END OF DAY (15 minutes)
----------------------------------------------
16. git push -u origin feature/[todays-task]
17. Go to GitHub, create Pull Request
18. Review the "Files changed" diff
19. Merge PR
20. git checkout main
21. git pull
22. Write in daily log: built, not finished, confusing, tomorrow
```

---

## When You Are Stuck

Try these in order. Do not skip to option 4 before trying option 1.

**Option 1: Read the error message**
Error messages are precise. Read the entire message. Often the solution is in the message itself.

**Option 2: Ask Claude Code to explain the error**
```
I got this error: [paste exact error]
I was trying to: [describe what you were doing]
What does this error mean? What is causing it?
```
Wait for the explanation. Understand the cause before accepting a fix.

**Option 3: Check official documentation**
- Supabase: supabase.com/docs
- Cloudflare Workers: developers.cloudflare.com/workers
- Next.js: nextjs.org/docs

**Option 4: Sleep on it**
Many bugs resolve overnight. This is not a joke.

---

## Best Practices: The Non-Negotiables

1. Commit every day, even if just configuration changes.
2. Never commit `.env.local`. API keys are not code.
3. Test in the browser after every meaningful change.
4. Write commit messages that would make sense to future you at 2 AM.
5. Read before you run. Understand what a command does before pressing Enter.
6. Keep `main` deployable. Feature branches protect `main`.
7. Ask Claude Code for explanations, not just solutions.
8. One task at a time. Finish today's task before adding tomorrow's scope.
9. When scope creep calls, write it in the backlog. Write it down and move on.
10. The 14-Day Plan is a guide, not a prison. Every piece must be correct before the next one starts.

---

*This guide is a living document. When you learn something new, when you make a mistake and recover, when you find a better way — add it here. The most valuable documentation is the kind you wrote for yourself.*
