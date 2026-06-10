# PersonalityOS — Claude Engineering Guide

**Audience:** Every Claude Code session working in this repository
**Purpose:** Rules and standards that Claude must follow in every session
**Last Updated:** June 2026

---

## Before You Write a Single Line of Code

Every Claude Code session must do this first. No exceptions.

```
Step 1: Read .claude/project.md
  This tells you the current phase, constraints, and forbidden actions.
  If this file says "V1 build", do not suggest V2 features.

Step 2: Read docs/SYSTEM_ARCHITECTURE.md
  This tells you the technical decisions that are already made.
  Do not propose alternatives to these decisions.

Step 3: Read docs/DATABASE_SCHEMA.md
  This tells you exactly what tables exist and what their fields mean.
  Do not invent new tables or new fields without CTO Agent approval.

Step 4: Read docs/MVP_SCOPE.md
  This tells you what is in V1 and what is not.
  Do not build features that are not in the current scope.

Step 5: Confirm you have read the docs.
  Say: "I have read the four core documents. Here is what we are building today: [summary in two sentences]."
  Then wait for the founder to confirm before writing code.
```

If the founder gives you a context prompt at the start of the session, you still read the documents. The prompt adds today's task. The documents contain the non-negotiable constraints.

---

## Repository Rules

### Files You Can Create
- Any file inside `app/` (Next.js pages)
- Any file inside `components/` (React components)
- Any file inside `workers/api/src/` (backend code)
- Any file inside `lib/` (shared utilities)
- New documentation files in `docs/`

### Files You Must NOT Create Without Explicit Approval
- Anything in `.github/` (GitHub Actions — see GITHUB_ACTIONS_PLAN.md)
- New files in `workers/` outside of `api/` (no new Workers in V1)
- Any new configuration file at the project root without explaining why

### Files You Must Never Modify
- `.env.local` (environment variables — the founder manages these)
- `.dev.vars` (Worker secrets — the founder manages these)
- `wrangler.toml` (Worker config — explain changes, get approval first)
- The database migration SQL in `docs/DATABASE_SCHEMA.md` (schema is final for V1)

### Files You Must Always Check Exist
Before any session, verify these files exist. If they are missing, tell the founder:
- `.gitignore` (must include .env.local, .dev.vars, node_modules/)
- `docs/PRODUCT_VISION.md`
- `docs/MVP_SCOPE.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/SYSTEM_ARCHITECTURE.md`

---

## Coding Rules

### Rule 1: TypeScript First
Every file is TypeScript (.ts or .tsx). No JavaScript (.js) files except configuration files that require it (next.config.mjs, tailwind.config.ts). No `any` types unless there is a documented reason.

### Rule 2: One File, One Responsibility
Each file does one thing. A component file contains one component. A route file handles one route group. A service file handles one domain.

Bad:
```typescript
// characters.ts — creates characters AND handles chat AND generates images
```

Good:
```typescript
// routes/characters.ts — only character CRUD
// routes/chat.ts — only chat/LLM calls
// routes/generate.ts — only image generation
```

### Rule 3: The Provider Adapter Is Sacred
Never call MuAPI, FAL, or any generation provider directly from business logic.
Always go through: `getProvider('image').generateImage(prompt, options)`

If asked to add a new image generation provider, you add a new adapter file in `workers/api/src/providers/image/`. You update `factory.ts`. You do not touch any route or service file.

### Rule 4: JWT Before Data
Every `/api/*` route handler must:
1. Verify the JWT token first
2. Extract `user_id` from the verified JWT
3. Never accept `user_id` from the request body

This pattern:
```typescript
const userId = c.get('userId'); // from JWT middleware
// NEVER: const { userId } = await c.req.json();
```

### Rule 5: User_id On Every Query
Every Supabase query that reads or writes user data must include `.eq('user_id', userId)`. No exceptions.

### Rule 6: No Secrets in Code
API keys, passwords, database credentials: never in source code. Always from environment variables.

### Rule 7: Handle All Three States
Every data-dependent UI component must handle:
- Loading state (show a Skeleton placeholder)
- Success state (show the data)
- Error state (show a friendly error message with a retry option)

If a component does not handle all three states, it is incomplete.

### Rule 8: No Direct Supabase Calls From Components
Frontend components only call the Worker API (`/api/*`). They never import the Supabase client to query tables directly. The only exception: `@supabase/ssr` for authentication.

---

## Documentation Rules

### Rule 1: Update Docs When Architecture Changes
If you make a change that affects the system architecture:
- Update `docs/SYSTEM_ARCHITECTURE.md`
- Add a comment explaining why the change was made

You do not need to update docs for routine feature additions. You do need to update them for: new services, new external dependencies, new environment variables, changes to authentication flow.

### Rule 2: Add a New Environment Variable? Document It
If you add a new environment variable, add it to the table in `docs/SYSTEM_ARCHITECTURE.md` Environment Variables section. Tell the founder what value to set and where to set it.

### Rule 3: Add a New Dependency? Explain It
If you run `npm install [package]`, first tell the founder:
- What the package does (plain English)
- Why it is needed
- If there is an alternative already in the project
Wait for approval before installing.

### Rule 4: Complex Logic Gets Comments
Any function longer than 20 lines needs a comment at the top explaining what it does and why it exists. Not how it works line-by-line — why it exists.

---

## Commit Message Rules

Claude Code should suggest a commit message after every meaningful working change. The founder runs the actual commit, but Claude recommends the message.

### Format
```
[type]: [short description in present tense]

[optional body: explain why, not what]
```

### Types
- `feat:` — new feature or new capability
- `fix:` — bug fix
- `chore:` — maintenance (update dependencies, clean up, config)
- `docs:` — documentation change only
- `style:` — formatting, no logic change
- `refactor:` — code restructure, no behavior change

### Examples

Good commit messages:
```
feat: add character creation form with DNA fields
fix: prevent image generation when reference photo is missing
chore: add .env.example file with all required variables
docs: update SYSTEM_ARCHITECTURE with new Worker environment variables
feat: implement MuAPI Provider Adapter with polling logic
fix: return 401 instead of 500 when JWT is expired
```

Bad commit messages:
```
stuff
update
fix bug
changes
wip
```

### Size Rule
One commit = one logical change. Do not bundle 5 different things into one commit. If Claude worked on three features in one session, suggest three separate commits.

---

## Review Rules

### Before Suggesting a Commit, Claude Must Verify

1. **Security check:** Grep the changed files for: `MUAPI_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_KEY`, `password`, `secret`. If any literal values appear (not environment variable references), stop and fix before suggesting a commit.

2. **Type check:** Run `npm run type-check` if it is configured. Fix any TypeScript errors before suggesting a commit.

3. **Build check:** If significant changes were made to routing or component structure, suggest running `npm run build` before committing.

4. **Three States check:** If a new component was created, verify it has loading/success/error states.

5. **Auth check:** If a new API route was created, verify it has JWT verification.

### Large Changes Require Review Pause

If a session produced changes to more than 5 files, pause before suggesting a commit. Instead:

```
I have made changes to [N] files. Before committing, I recommend reviewing:
- [File 1]: [what changed and why]
- [File 2]: [what changed and why]
...

The changes that carry the most risk are: [file names and reason]
Would you like me to walk through any of these in more detail?
```

This prevents the founder from committing a large change they do not understand.

---

## What Claude Should Never Do

1. **Never suggest `git push --force`** on `main` or `develop`. Force pushing rewrites history and can permanently destroy commits on shared branches.

2. **Never suggest running database migrations** without showing the founder the exact SQL first. Schema changes can be irreversible.

3. **Never suggest deleting R2 files** in production without an explicit instruction to do so. Generation assets are permanent by design.

4. **Never suggest installing a package that requires a credit card or paid tier** without flagging the cost to the founder.

5. **Never bypass the Provider Adapter** even if "just for testing" or "just temporarily." The whole point of the adapter is consistency.

6. **Never suggest building V2/V3/V4 features** while V1 is incomplete. Write them to BACKLOG.md instead.

7. **Never suggest using D1 or any second database** in V1. Supabase is the single database.

8. **Never suggest adding pgvector or RAG infrastructure** in V1. There are no knowledge uploads in V1.

9. **Never suggest audio/voice components, tables, or routes** in V1.

10. **Never commit** `.env.local` or `.dev.vars`. If these files appear in `git status`, stop the session and add them to `.gitignore` first.

---

## The Standard Session Flow

### Good session:

```
[Founder gives context prompt]
→ Claude reads docs and confirms understanding
→ Claude asks clarifying question if needed
→ Founder confirms
→ Claude writes code (one logical piece at a time)
→ Claude explains what was written
→ Founder tests in browser
→ Claude suggests commit message
→ Founder commits
→ Repeat for next piece
```

### Red flags — stop the session if:

- Claude is writing code without having read the docs
- Claude is writing more than one feature without testing the first
- The session has gone 90+ minutes without a single commit
- Claude is suggesting changes to `.env.local`, `wrangler.toml`, or the database schema without flagging them
- Claude is building something not in MVP_SCOPE.md without flagging it as out of scope
